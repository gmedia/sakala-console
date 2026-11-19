import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import {
	getDatabaseCredentials,
	parseCredentials,
	parseDatabase,
	parseDatabaseList,
	rotateDatabasePassword,
	type Database
} from '$lib/api/resources/databases';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import { errorFromDatabaseFixture, getDatabaseFixture } from '$lib/testing/database-fixtures';
import { databaseAccess } from '../access';
import DatabaseConnectionCard from './DatabaseConnectionCard.svelte';

vi.mock('$lib/config/public', () => ({
	publicConfig: { apiUrl: 'http://api.test', appUrl: 'http://app.test' }
}));
vi.mock('$lib/api/resources/databases', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/resources/databases')>()),
	getDatabaseCredentials: vi.fn(),
	rotateDatabasePassword: vi.fn()
}));

const ready = parseDatabaseList(getDatabaseFixture('databases').body).find(
	(database) => database.projects.length > 0
)!;
const provisioning = parseDatabase(getDatabaseFixture('database-create').body);
const credentials = parseCredentials(getDatabaseFixture('credentials').body);

function renderCard(role: 'owner' | 'member' | 'viewer', database: Database = ready) {
	const onRotated = vi.fn();
	render(QueryTestHost, {
		props: {
			component: DatabaseConnectionCard,
			props: { database, workspaceId: 'ws-1', access: databaseAccess(role, false), onRotated }
		}
	});
	return onRotated;
}

const card = () => page.getByTestId('database-connection');

beforeEach(() => {
	vi.mocked(getDatabaseCredentials).mockReset();
	vi.mocked(rotateDatabasePassword).mockReset();
});

describe('DatabaseConnectionCard', () => {
	it('reads the audited credentials only when an owner presses Tampilkan', async () => {
		vi.mocked(getDatabaseCredentials).mockResolvedValue(credentials);
		renderCard('owner');
		await expect.element(card().getByText(/Sakala mencatatnya di log audit/)).toBeVisible();
		expect(getDatabaseCredentials).not.toHaveBeenCalled();
		await expect.element(card()).not.toHaveTextContent(credentials.password);

		await page.getByTestId('reveal-credentials').click();
		expect(getDatabaseCredentials).toHaveBeenCalledWith('ws-1', ready.id);
		await expect.element(card()).toHaveTextContent(credentials.password);
		await expect.element(card()).toHaveTextContent(credentials.url!);

		await card().getByRole('button', { name: 'Sembunyikan' }).click();
		await expect.element(card()).not.toHaveTextContent(credentials.password);
	});

	it('says where the address is missing when the node has not reported it', async () => {
		vi.mocked(getDatabaseCredentials).mockResolvedValue({
			...credentials,
			host: null,
			port: null,
			url: null
		});
		renderCard('owner');
		await page.getByTestId('reveal-credentials').click();
		await expect
			.element(
				card()
					.getByText(/belum melaporkan alamatnya/)
					.first()
			)
			.toBeVisible();
	});

	it('tells a member and a viewer why the credentials stay hidden, without asking the API', async () => {
		renderCard('member');
		await expect
			.element(page.getByTestId('credentials-owner-only'))
			.toHaveTextContent(/hanya bisa dilihat pemilik workspace/);
		await expect.element(page.getByTestId('reveal-credentials')).not.toBeInTheDocument();
		expect(getDatabaseCredentials).not.toHaveBeenCalled();
	});

	it('explains a refused read', async () => {
		vi.mocked(getDatabaseCredentials).mockRejectedValue(
			errorFromDatabaseFixture('credentials-member')
		);
		renderCard('owner');
		await page.getByTestId('reveal-credentials').click();
		await expect
			.element(card().getByRole('alert'))
			.toHaveTextContent('Kredensial hanya bisa dilihat pemilik workspace.');
	});

	it('waits for the database to be ready before credentials exist', async () => {
		renderCard('owner', provisioning);
		await expect.element(page.getByTestId('credentials-not-ready')).toBeVisible();
		await expect.element(page.getByTestId('rotate-password')).toBeDisabled();
	});

	it('rotates only after a confirmation that names the projects to redeploy', async () => {
		vi.mocked(rotateDatabasePassword).mockResolvedValue(ready);
		const onRotated = renderCard('member');
		await page.getByTestId('rotate-password').click();

		const dialog = page.getByRole('dialog', { name: 'Ganti password database?' });
		await expect.element(dialog).toHaveTextContent(/koneksi barunya akan ditolak/);
		await expect.element(dialog).toHaveTextContent(new RegExp(ready.projects[0].name));
		expect(rotateDatabasePassword).not.toHaveBeenCalled();
		await dialog.getByRole('button', { name: 'Ganti password' }).click();

		expect(rotateDatabasePassword).toHaveBeenCalledWith('ws-1', ready.id);
		await expect.element(page.getByTestId('rotation-requested')).toBeVisible();
		expect(onRotated).toHaveBeenCalledOnce();
	});

	it('keeps the dialog open when a rotation is already running', async () => {
		vi.mocked(rotateDatabasePassword).mockRejectedValue(
			errorFromDatabaseFixture('rotate-password-busy')
		);
		renderCard('owner');
		await page.getByTestId('rotate-password').click();
		const dialog = page.getByRole('dialog', { name: 'Ganti password database?' });
		await dialog.getByRole('button', { name: 'Ganti password' }).click();
		await expect.element(dialog.getByRole('alert')).toHaveTextContent(/masih berjalan/);
	});

	it('gives a viewer no way to rotate', async () => {
		renderCard('viewer');
		await expect.element(page.getByTestId('rotate-password')).not.toBeInTheDocument();
	});
});

import { page, userEvent } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { parseDatabaseList, renameDatabase, type Database } from '$lib/api/resources/databases';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import { errorFromDatabaseFixture, getDatabaseFixture } from '$lib/testing/database-fixtures';
import DatabaseOverviewCard from './DatabaseOverviewCard.svelte';

vi.mock('$app/navigation', () => ({
	goto: vi.fn(),
	replaceState: vi.fn(),
	afterNavigate: vi.fn()
}));
vi.mock('$lib/config/public', () => ({
	publicConfig: { apiUrl: 'http://api.test', appUrl: 'http://app.test' }
}));
vi.mock('$lib/api/resources/databases', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/resources/databases')>()),
	renameDatabase: vi.fn()
}));

const ready = parseDatabaseList(getDatabaseFixture('databases').body).find(
	(database) => database.status === 'ready'
)!;

const renderCard = (database: Database, canManage = true) =>
	render(QueryTestHost, {
		props: {
			component: DatabaseOverviewCard,
			props: { database, workspaceId: 'ws-1', canManage }
		}
	});

const editName = () => page.getByRole('button', { name: 'Ubah nama database' });

beforeEach(() => {
	vi.mocked(renameDatabase).mockReset();
});

describe('DatabaseOverviewCard renaming in place', () => {
	it('gives a viewer the name without a way to change it', async () => {
		renderCard(ready, false);
		await expect.element(page.getByRole('heading', { name: ready.name })).toBeVisible();
		await expect.element(editName()).not.toBeInTheDocument();
	});

	it('opens under the name with the name selected, and Escape closes it', async () => {
		renderCard(ready);
		await editName().click();
		await expect.element(page.getByLabelText('Nama database', { exact: true })).toHaveFocus();
		await expect
			.element(page.getByLabelText('Nama database', { exact: true }))
			.toHaveValue(ready.name);
		await userEvent.keyboard('{Escape}');
		await expect
			.element(page.getByLabelText('Nama database', { exact: true }))
			.not.toBeInTheDocument();
		await expect.element(editName()).toHaveFocus();
	});

	it('saves a new name and closes', async () => {
		vi.mocked(renameDatabase).mockResolvedValue({ ...ready, name: 'kasir-baru' });
		renderCard(ready);
		await editName().click();
		await page.getByLabelText('Nama database', { exact: true }).fill('kasir-baru');
		await page.getByRole('button', { name: 'Simpan nama' }).click();
		expect(renameDatabase).toHaveBeenCalledWith('ws-1', ready.id, 'kasir-baru');
		await expect
			.element(page.getByLabelText('Nama database', { exact: true }))
			.not.toBeInTheDocument();
	});

	it('puts a refusal on the field and stays open', async () => {
		vi.mocked(renameDatabase).mockRejectedValue(
			errorFromDatabaseFixture('database-create-invalid')
		);
		renderCard(ready);
		await editName().click();
		await page.getByLabelText('Nama database', { exact: true }).fill('nama-yang-dipakai');
		await page.getByRole('button', { name: 'Simpan nama' }).click();
		await expect.element(page.getByText('nama ini sudah dipakai. Pakai nama lain.')).toBeVisible();
		await expect
			.element(page.getByLabelText('Nama database', { exact: true }))
			.toHaveAttribute('aria-invalid', 'true');
	});
});

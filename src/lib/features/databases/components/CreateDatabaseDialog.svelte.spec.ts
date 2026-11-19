import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { goto } from '$app/navigation';
import { createDatabase, parseDatabase } from '$lib/api/resources/databases';
import { listRegions } from '$lib/api/resources/regions';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import { errorFromDatabaseFixture, getDatabaseFixture } from '$lib/testing/database-fixtures';
import CreateDatabaseDialog from './CreateDatabaseDialog.svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn().mockResolvedValue(undefined) }));
vi.mock('$lib/config/public', () => ({
	publicConfig: { apiUrl: 'http://api.test', appUrl: 'http://app.test' }
}));
vi.mock('$lib/api/resources/databases', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/resources/databases')>()),
	createDatabase: vi.fn()
}));
vi.mock('$lib/api/resources/regions', () => ({ listRegions: vi.fn() }));

const created = parseDatabase(getDatabaseFixture('database-create').body);

function open(props: Record<string, unknown> = {}) {
	return render(QueryTestHost, {
		props: {
			component: CreateDatabaseDialog,
			props: { open: true, workspaceId: 'ws-1', workspaceName: 'Tim Facility', ...props }
		}
	});
}

const dialog = () => page.getByRole('dialog', { name: 'Buat database' });
const submit = () => dialog().getByRole('button', { name: /Buat database|Membuat/ });

beforeEach(() => {
	vi.mocked(createDatabase).mockReset();
	vi.mocked(listRegions).mockReset().mockResolvedValue(['jkt', 'sby']);
	vi.mocked(goto).mockClear();
});

describe('CreateDatabaseDialog', () => {
	it('focuses the name and asks for one before sending anything', async () => {
		await open();
		await expect.element(dialog().getByLabelText('Nama database')).toHaveFocus();
		await submit().click();
		await expect.element(dialog().getByText(/Isi nama database/)).toBeVisible();
		expect(createDatabase).not.toHaveBeenCalled();
	});

	it('defaults to the automatic region and names the workspace region it resolves to', async () => {
		await open({ workspaceDefaultRegion: 'jkt' });
		await expect.element(dialog().getByLabelText('Region')).toHaveValue('');
		await expect
			.element(dialog().getByRole('option', { name: 'Otomatis (jkt)' }))
			.toBeInTheDocument();
		await expect
			.element(dialog().getByText(/Memakai region bawaan workspace, jkt\./))
			.toBeVisible();
	});

	it('says Sakala picks a server when the workspace has no default region', async () => {
		await open();
		await expect.element(dialog().getByRole('option', { name: 'Otomatis' })).toBeInTheDocument();
		await expect.element(dialog().getByText(/tidak punya region bawaan/)).toBeVisible();
	});

	it('preselects the region of the project the user came from', async () => {
		await open({ defaultRegion: 'sby', projectId: 'p-1', projectName: 'toko-kopi-web' });
		await expect.element(dialog().getByLabelText('Region')).toHaveValue('sby');
		await expect
			.element(dialog().getByText(/Region yang sama dengan proyek toko-kopi-web/))
			.toBeVisible();
	});

	it('creates with region null for Otomatis and opens the new database', async () => {
		vi.mocked(createDatabase).mockResolvedValue(created);
		await open();
		await dialog().getByLabelText('Nama database').fill('  toko-kopi-db  ');
		await submit().click();

		expect(createDatabase).toHaveBeenCalledWith('ws-1', { name: 'toko-kopi-db', region: null });
		await expect.element(dialog()).not.toBeInTheDocument();
		expect(goto).toHaveBeenCalledWith(`/databases/${created.id}?workspace=ws-1`);
	});

	it('shows a taken name on the field and a quota refusal in the dialog', async () => {
		vi.mocked(createDatabase).mockRejectedValueOnce(
			errorFromDatabaseFixture('database-create-invalid')
		);
		await open();
		await dialog().getByLabelText('Nama database').fill('toko-kopi-db');
		await submit().click();
		await expect
			.element(dialog().getByText('nama ini sudah dipakai. Pakai nama lain.'))
			.toBeVisible();

		vi.mocked(createDatabase).mockRejectedValueOnce(
			errorFromDatabaseFixture('database-create-storage-limit')
		);
		await dialog().getByLabelText('Nama database').fill('lain');
		await submit().click();
		await expect
			.element(dialog().getByTestId('create-database-error'))
			.toHaveTextContent(/sudah penuh \(20 MB dari 10 MB\)/);
	});

	it('says why instead of showing the form when the quota is used up', async () => {
		await open({ blockedReason: 'Workspace ini sudah memakai 2 dari 2 database.' });
		await expect
			.element(dialog().getByTestId('create-database-blocked'))
			.toHaveTextContent('Workspace ini sudah memakai 2 dari 2 database.');
		await expect.element(dialog().getByLabelText('Nama database')).not.toBeInTheDocument();
		await expect.element(dialog().getByRole('button', { name: 'Tutup' })).toHaveFocus();
	});
});

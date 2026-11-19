import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { parseDatabase, parseDatabaseList } from '$lib/api/resources/databases';
import { getDatabaseFixture } from '$lib/testing/database-fixtures';
import DatabaseList from './DatabaseList.svelte';

vi.mock('$lib/config/public', () => ({
	publicConfig: { apiUrl: 'http://api.test', appUrl: 'http://app.test' }
}));

const WORKSPACE_ID = 'ws-1';
const databases = parseDatabaseList(getDatabaseFixture('databases').body);
const provisioning = {
	...parseDatabase(getDatabaseFixture('database-create').body),
	id: 'db-provisioning'
};
const deleting = {
	...parseDatabase(getDatabaseFixture('database-delete').body),
	id: 'db-deleting'
};

const rows = () => page.getByTestId('database-row');

describe('DatabaseList', () => {
	it('shows every status in words, with the reason where one is needed', async () => {
		render(DatabaseList, {
			props: { databases: [provisioning, deleting, ...databases], workspaceId: WORKSPACE_ID }
		});
		await expect.element(rows().nth(0)).toHaveTextContent(/Menyiapkan/);
		await expect
			.element(rows().nth(0))
			.toHaveTextContent(/Sedang dibuat di server database, dimulai/);
		await expect.element(rows().nth(1)).toHaveTextContent(/Menghapus/);
		await expect.element(rows().nth(1)).toHaveTextContent(/Sedang dihapus beserta datanya/);
		await expect.element(rows().nth(2)).toHaveTextContent(/Gagal dibuat\. Hapus lalu buat lagi\./);
		await expect.element(rows().nth(3)).toHaveTextContent(/Terkunci/);
		await expect
			.element(rows().nth(3))
			.toHaveTextContent(/Aplikasi tidak bisa terhubung karena penyimpanan workspace penuh/);
	});

	it('names attached projects, or says there are none, and the region', async () => {
		render(DatabaseList, { props: { databases, workspaceId: WORKSPACE_ID } });
		await expect.element(rows().nth(3)).toHaveTextContent(/toko-kopi-web/);
		await expect.element(rows().nth(2)).toHaveTextContent(/Belum dipasang ke proyek/);
		await expect.element(rows().nth(3)).toHaveTextContent(/jkt/);
	});

	it('measures each size against the workspace quota, and says when it was never measured', async () => {
		render(DatabaseList, { props: { databases, workspaceId: WORKSPACE_ID, storageQuotaMb: 512 } });
		await expect
			.element(page.getByRole('meter', { name: 'Ukuran toko-kopi-db terhadap kuota workspace' }))
			.toHaveAttribute('aria-valuetext', '12 MB dari 512 MB, 2% dari kuota');
		await expect.element(rows().nth(0)).toHaveTextContent(/Belum diukur/);
	});

	it('links each row to its database page with the workspace, and the project being attached', async () => {
		render(DatabaseList, {
			props: { databases, workspaceId: WORKSPACE_ID, projectId: 'p-1' }
		});
		await expect
			.element(page.getByRole('link', { name: 'analitik' }))
			.toHaveAttribute('href', `/databases/${databases[2].id}?workspace=ws-1&project=p-1`);
	});
});

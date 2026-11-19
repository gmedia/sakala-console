import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { goto } from '$app/navigation';
import {
	deleteDatabase,
	parseDatabase,
	parseDatabaseList,
	type Database
} from '$lib/api/resources/databases';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import { errorFromDatabaseFixture, getDatabaseFixture } from '$lib/testing/database-fixtures';
import DatabaseSettingsCard from './DatabaseSettingsCard.svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn().mockResolvedValue(undefined) }));
vi.mock('$lib/config/public', () => ({
	publicConfig: { apiUrl: 'http://api.test', appUrl: 'http://app.test' }
}));
vi.mock('$lib/api/resources/databases', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/resources/databases')>()),
	deleteDatabase: vi.fn()
}));

const all = parseDatabaseList(getDatabaseFixture('databases').body);
const attached = all.find((database) => database.projects.length > 0)!;
const free = all.find((database) => database.name === 'analitik')!;
const deleting = parseDatabase(getDatabaseFixture('database-delete').body);

const renderCard = (database: Database) =>
	render(QueryTestHost, {
		props: { component: DatabaseSettingsCard, props: { database, workspaceId: 'ws-1' } }
	});

beforeEach(() => {
	vi.mocked(deleteDatabase).mockReset();
	vi.mocked(goto).mockClear();
});

describe('DatabaseSettingsCard', () => {
	it('blocks deleting while projects are attached, and says which', async () => {
		renderCard(attached);
		await expect.element(page.getByTestId('delete-database')).toBeDisabled();
		await expect
			.element(page.getByTestId('delete-blocked'))
			.toHaveTextContent(
				`Masih dipasang ke ${attached.projects[0].name}. Lepas dari semua proyek dulu`
			);
	});

	it('deletes only after the name is typed, then returns to the list', async () => {
		vi.mocked(deleteDatabase).mockResolvedValue(deleting);
		renderCard(free);
		await page.getByTestId('delete-database').click();

		const dialog = page.getByRole('dialog', { name: `Hapus ${free.name}?` });
		const confirm = dialog.getByRole('button', { name: 'Hapus database ini' });
		await expect.element(confirm).toBeDisabled();
		await expect.element(dialog.getByLabelText(/untuk konfirmasi/)).toHaveFocus();
		await dialog.getByLabelText(/untuk konfirmasi/).fill(free.name);
		await confirm.click();

		expect(deleteDatabase).toHaveBeenCalledWith('ws-1', free.id);
		expect(goto).toHaveBeenCalledWith('/databases');
	});

	it('explains a refusal from the API in the dialog', async () => {
		vi.mocked(deleteDatabase).mockRejectedValue(errorFromDatabaseFixture('database-delete-in-use'));
		renderCard(free);
		await page.getByTestId('delete-database').click();
		const dialog = page.getByRole('dialog', { name: `Hapus ${free.name}?` });
		await dialog.getByLabelText(/untuk konfirmasi/).fill(free.name);
		await dialog.getByRole('button', { name: 'Hapus database ini' }).click();
		await expect
			.element(dialog.getByRole('alert'))
			.toHaveTextContent(/Lepas dulu dari semua proyek/);
	});
});

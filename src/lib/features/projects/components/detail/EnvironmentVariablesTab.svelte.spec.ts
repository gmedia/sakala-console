import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { apiRequest } from '$lib/api/client';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import EnvironmentVariablesTab from './EnvironmentVariablesTab.svelte';

vi.mock('$app/state', () => ({
	page: { url: new URL('http://localhost/projects/p-1/environments') }
}));
vi.mock('$lib/api/client', () => ({ apiRequest: vi.fn() }));

const inspection = (entries: { key: string; example_value: string | null }[] | null) => ({
	repository_url: null,
	commit_sha: null,
	dockerfile_found: false,
	env_example_found: true,
	compose_found: false,
	manifests: [],
	package_manager: null,
	inspected_at: null,
	env_example: entries ? { file: '.env.example', entries, truncated: false } : null,
	database_hint: null
});

const project = (entries: { key: string; example_value: string | null }[] | null) => ({
	id: 'p-1',
	name: 'toko-kopi',
	public_url: 'https://toko-kopi.sakala.app',
	redeploy_required: false,
	databases: [],
	workspace: { id: 'w-1', name: 'Rani', slug: 'rani', type: 'personal' },
	preview_status: 'succeeded',
	inspection: inspection(entries)
});

let current = project([
	{ key: 'APP_NAME', example_value: 'Toko' },
	{ key: 'APP_KEY', example_value: null },
	{ key: 'SMTP_PASSWORD', example_value: null }
]);

function renderTab() {
	return render(QueryTestHost, {
		props: { component: EnvironmentVariablesTab, props: { projectId: 'p-1' } }
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(apiRequest).mockImplementation(async (path, options) => {
		const url = String(path);
		if (options?.method === 'POST') return { data: { id: 9, ...(options.json as object) } };
		if (url.endsWith('/environment-variables')) {
			return {
				data: [
					{
						id: 1,
						key: 'APP_KEY',
						is_secret: true,
						value: null,
						created_at: '2026-01-01T00:00:00Z'
					}
				]
			};
		}
		if (url.includes('/workspaces')) return { data: [] };
		return { data: current };
	});
});

describe('Variabel tab, "Isi dari .env.example"', () => {
	it('opens the suggestions with inputs, and never replaces a live APP_KEY', async () => {
		await renderTab();

		await page.getByRole('button', { name: 'Isi dari .env.example' }).click();
		await expect.element(page.getByText('Untuk 1 variabel yang sudah ada (APP_KEY)')).toBeVisible();
		await page.getByLabelText('Timpa dengan nilai di bawah').click();
		await expect
			.element(page.getByText(/Kunci acak yang sudah ada \(APP_KEY\) tidak diganti/))
			.toBeVisible();
		await page.getByRole('textbox', { name: 'Nilai SMTP_PASSWORD' }).fill('rahasia');
		await page.getByRole('button', { name: 'Simpan 2 variabel' }).click();

		await vi.waitFor(() =>
			expect(vi.mocked(apiRequest)).toHaveBeenCalledWith(
				'/api/v1/app/projects/p-1/environment-variables',
				expect.objectContaining({
					method: 'POST',
					json: { key: 'SMTP_PASSWORD', value: 'rahasia', is_secret: true }
				})
			)
		);
		const keys = vi
			.mocked(apiRequest)
			.mock.calls.filter(([, options]) => options?.method === 'POST' || options?.method === 'PATCH')
			.map(([, options]) => (options?.json as { key?: string }).key);
		expect(keys).toEqual(['APP_NAME', 'SMTP_PASSWORD']);
	});

	it('is not offered when the inspection has no entries', async () => {
		current = project(null);
		await renderTab();

		await expect.element(page.getByRole('button', { name: 'Tempel dari .env' })).toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'Isi dari .env.example' }))
			.not.toBeInTheDocument();
	});
});

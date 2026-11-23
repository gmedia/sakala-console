import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { goto } from '$app/navigation';
import { listLimitProfiles, parseLimitProfiles } from '$lib/api/resources/admin/accounts';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import profilesFixture from '../../../../../../tests/fixtures/admin/limit-profiles.json';
import LimitProfilesPage from './LimitProfilesPage.svelte';

const currentUrl = vi.hoisted(() => ({ url: new URL('http://localhost/admin/limit-profiles') }));

vi.mock('$app/state', () => ({
	page: {
		get url() {
			return currentUrl.url;
		}
	}
}));
vi.mock('$app/navigation', () => ({ goto: vi.fn().mockResolvedValue(undefined) }));
vi.mock('$lib/config/public', () => ({
	publicConfig: { apiUrl: 'http://api.test', appUrl: 'http://app.test' }
}));
vi.mock('$lib/api/resources/admin/accounts', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/resources/admin/accounts')>()),
	listLimitProfiles: vi.fn()
}));

const kelas = profilesFixture.body.data[0];
const listWith = (overrides: Record<string, unknown>) =>
	parseLimitProfiles({ ...profilesFixture.body, data: [{ ...kelas, ...overrides }] });

const renderPage = () => render(QueryTestHost, { props: { component: LimitProfilesPage } });

beforeEach(() => {
	currentUrl.url = new URL('http://localhost/admin/limit-profiles');
	vi.mocked(goto).mockClear();
	vi.mocked(listLimitProfiles).mockReset().mockResolvedValue(listWith({}));
});

describe('the limit profiles list', () => {
	it('shows Build/jam, empty as the server default (Bawaan)', async () => {
		await renderPage();

		await expect.element(page.getByRole('columnheader', { name: 'Build/jam' })).toBeVisible();
		await expect.element(page.getByRole('cell', { name: 'Bawaan', exact: true })).toBeVisible();
	});

	it('shows a profile’s own build limit, idle sleep, and replicas', async () => {
		vi.mocked(listLimitProfiles).mockResolvedValue(
			listWith({ max_builds_per_hour: 40, idle_sleep_minutes: 0, max_replicas: 4 })
		);
		await renderPage();

		await expect.element(page.getByRole('cell', { name: '40', exact: true })).toBeVisible();
		await expect.element(page.getByRole('cell', { name: 'Tidak pernah' })).toBeVisible();
		await expect.element(page.getByRole('cell', { name: '4', exact: true })).toBeVisible();
	});

	it('creates and edits on their own pages', async () => {
		await renderPage();

		await expect
			.element(page.getByRole('link', { name: 'Buat profil' }))
			.toHaveAttribute('href', '/admin/limit-profiles/new');
		await expect
			.element(page.getByRole('link', { name: `Ubah ${kelas.name}` }))
			.toHaveAttribute('href', `/admin/limit-profiles/${kelas.id}`);
		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
	});

	it('sends an old create link to the new page, keeping where to return', async () => {
		currentUrl.url = new URL(
			'http://localhost/admin/limit-profiles?create=1&return_to=%2Fadmin%2Fworkspaces%2Fws-1'
		);
		await renderPage();

		await expect
			.poll(() => vi.mocked(goto).mock.calls[0])
			.toEqual([
				'/admin/limit-profiles/new?return_to=%2Fadmin%2Fworkspaces%2Fws-1',
				{ replaceState: true }
			]);
	});
});

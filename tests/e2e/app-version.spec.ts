import { expect, test, type Page } from '@playwright/test';
import { TEAM, mockWorkspaceApi } from './fixtures/workspaces';

const NEW_VERSION_TOAST = 'Versi baru Sakala sudah tersedia';

/** A value that only survives client-side navigation; a full page load clears it. */
const markTab = (page: Page) =>
	page.evaluate(() => ((window as unknown as { tabMarker?: string }).tabMarker = 'sebelum'));
const tabMarker = (page: Page) =>
	page.evaluate(() => (window as unknown as { tabMarker?: string }).tabMarker ?? null);
const projectsLink = (page: Page) =>
	page.getByRole('link', { name: 'Proyek', exact: true }).first();

test.describe('a new Console version while a tab is open', () => {
	test('is announced and the next navigation loads the new build', async ({ page }) => {
		await page.clock.install();
		await mockWorkspaceApi(page, { persona: 'owner' });
		let deployed = false;
		await page.route('**/_app/version.json', (route) =>
			deployed
				? route.fulfill({ contentType: 'application/json', body: '{"version":"setelah-deploy"}' })
				: route.fallback()
		);

		await page.goto(`/workspaces/${TEAM.id}`);
		await expect(page.getByTestId('member-row')).toHaveCount(3);
		await markTab(page);

		// Before a deploy, navigation stays in the page.
		await projectsLink(page).click();
		await expect(page).toHaveURL(/\/projects$/);
		expect(await tabMarker(page)).toBe('sebelum');
		await page.goBack();
		await expect(page.getByTestId('member-row')).toHaveCount(3);

		// SvelteKit polls the version file; the clock jumps past its interval.
		deployed = true;
		await page.clock.fastForward('02:05');
		await expect(page.getByText(NEW_VERSION_TOAST)).toBeVisible();
		// Nothing reloads by itself.
		expect(await tabMarker(page)).toBe('sebelum');

		await projectsLink(page).click();
		await expect(page).toHaveURL(/\/projects$/);
		await expect(page.getByRole('heading', { name: 'Tugas Pribadi' })).toBeVisible();
		expect(await tabMarker(page)).toBeNull();
	});

	test('a chunk that fails to load is announced the same way', async ({ page }) => {
		await mockWorkspaceApi(page, { persona: 'owner' });
		await page.goto(`/workspaces/${TEAM.id}`);
		await expect(page.getByTestId('member-row')).toHaveCount(3);
		await markTab(page);

		// What Vite fires when a dynamic import of an old chunk fails after a deploy.
		await page.evaluate(() => window.dispatchEvent(new Event('vite:preloadError')));
		await expect(page.getByText(NEW_VERSION_TOAST)).toBeVisible();
		expect(await tabMarker(page)).toBe('sebelum');

		await projectsLink(page).click();
		await expect(page).toHaveURL(/\/projects$/);
		await expect(page.getByRole('heading', { name: 'Tugas Pribadi' })).toBeVisible();
		expect(await tabMarker(page)).toBeNull();
	});
});

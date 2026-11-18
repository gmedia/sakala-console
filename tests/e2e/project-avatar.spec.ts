import { expect, test } from '@playwright/test';
import { mockEveryRoute } from './fixtures/all-routes';
import { PROJECT_ID } from './fixtures/create-project';

test('a project keeps the same avatar on its card and in the page header', async ({ page }) => {
	await mockEveryRoute(page);
	await page.goto('/projects');

	const card = page.locator('article').filter({ has: page.locator(`a[href$="/${PROJECT_ID}"]`) });
	const cardAvatar = card.getByTestId('project-avatar');
	await expect(cardAvatar).toHaveText('TK');
	await expect(cardAvatar).toHaveAttribute('aria-hidden', 'true');
	const tone = await cardAvatar.getAttribute('data-tone');

	await card.getByRole('link', { name: 'toko-kopi-web', exact: true }).click();
	await expect(page).toHaveURL(new RegExp(`/projects/${PROJECT_ID}`));

	const headerAvatar = page.locator('header').getByTestId('project-avatar');
	await expect(headerAvatar).toHaveText('TK');
	await expect(headerAvatar).toHaveAttribute('data-tone', tone ?? '');
	// Decorative next to the name, so the heading still reads as the breadcrumb alone.
	await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName(
		'Proyek toko-kopi-web'
	);
});

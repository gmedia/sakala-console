import { expect, test } from '@playwright/test';

test('shows the honest foundation state', async ({ page }) => {
	await page.goto('/');

	await expect(page.getByRole('heading', { level: 1 })).toContainText('Build');
});

test('keeps deep links available through the static SPA fallback', async ({ page }) => {
	await page.route('**/api/v1/auth/user', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				data: {
					id: 1,
					name: 'Test User',
					email: 'test@sakala.local',
					avatar_url: null,
					role: 'user',
					onboarding_source: 'github',
					onboarding_completed_at: new Date().toISOString(),
					last_login_at: new Date().toISOString()
				}
			})
		});
	});

	await page.goto('/dashboard');

	await expect(page.getByRole('heading', { name: 'Projects' }).first()).toBeVisible();
	await expect(page.getByRole('navigation', { name: 'Navigasi utama' })).toBeVisible();
});

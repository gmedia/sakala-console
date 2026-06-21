import { expect, test } from '@playwright/test';

test('shows the honest foundation state', async ({ page }) => {
	await page.goto('/');

	await expect(page.getByRole('heading', { level: 1 })).toContainText('localhost');
	await expect(page.getByText('Console sedang disiapkan.')).toBeVisible();
});

test('keeps deep links available through the static SPA fallback', async ({ page }) => {
	await page.goto('/dashboard');

	await expect(page.getByRole('heading', { level: 1 })).toContainText('Selamat datang');
	await expect(page.getByRole('navigation', { name: 'Navigasi utama' })).toBeVisible();
});

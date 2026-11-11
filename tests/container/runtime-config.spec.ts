import { expect, test } from '@playwright/test';

const expectedApiOrigin = process.env.EXPECTED_API_ORIGIN ?? '';

test('the container points the console at the API from its environment', async ({ page }) => {
	test.skip(!process.env.CONSOLE_URL || !expectedApiOrigin, 'Run through runtime-config.sh');

	const origins: string[] = [];
	await page.route('**/api/v1/auth/user', (route) => {
		origins.push(new URL(route.request().url()).origin);
		return route.fulfill({
			status: 401,
			contentType: 'application/json',
			body: JSON.stringify({ message: 'Unauthenticated.' })
		});
	});
	const violations: string[] = [];
	page.on('console', (message) => {
		if (/Content Security Policy/i.test(message.text())) violations.push(message.text());
	});

	await page.goto('/projects');

	await expect(page).toHaveURL(/\/login/);
	expect(new Set(origins)).toEqual(new Set([expectedApiOrigin]));
	expect(violations).toEqual([]);
});

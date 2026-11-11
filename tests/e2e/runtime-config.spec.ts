import { expect, test, type Page } from '@playwright/test';

// The container renders /runtime-config.js from its environment (docker/entrypoint.sh). These
// tests stand in for that file, so they prove the built bundle reads it before it starts and
// talks to the API it names. tests/container/runtime-config.sh covers the entrypoint itself.

async function serveRuntimeConfig(page: Page, config: Record<string, string>) {
	await page.route('**/runtime-config.js', (route) =>
		route.fulfill({
			contentType: 'text/javascript',
			body: `window.__SAKALA_RUNTIME_CONFIG__ = ${JSON.stringify(config)};`
		})
	);
}

async function recordUserRequests(page: Page) {
	const origins: string[] = [];
	await page.route('**/api/v1/auth/user', (route) => {
		origins.push(new URL(route.request().url()).origin);
		return route.fulfill({
			status: 401,
			contentType: 'application/json',
			body: JSON.stringify({ message: 'Unauthenticated.' })
		});
	});
	return origins;
}

test('calls the API named by the runtime config instead of the built one', async ({ page }) => {
	await serveRuntimeConfig(page, { PUBLIC_API_URL: 'https://api.selfhost.example' });
	const origins = await recordUserRequests(page);

	await page.goto('/projects');

	await expect(page).toHaveURL(/\/login/);
	expect(origins.length).toBeGreaterThan(0);
	expect(new Set(origins)).toEqual(new Set(['https://api.selfhost.example']));
});

test('keeps the built API when the runtime config is empty', async ({ page }) => {
	await serveRuntimeConfig(page, {});
	const origins = await recordUserRequests(page);

	await page.goto('/projects');

	await expect(page).toHaveURL(/\/login/);
	expect(origins.length).toBeGreaterThan(0);
	expect(origins).not.toContain('https://api.selfhost.example');
});

test('ignores a runtime API URL that is not http or https', async ({ page }) => {
	await serveRuntimeConfig(page, { PUBLIC_API_URL: 'javascript:alert(1)' });
	const origins = await recordUserRequests(page);

	await page.goto('/projects');

	await expect(page).toHaveURL(/\/login/);
	expect(origins.length).toBeGreaterThan(0);
	expect(origins.every((origin) => origin.startsWith('http'))).toBe(true);
});

test('the shipped build serves an empty runtime config', async ({ request }) => {
	const response = await request.get('/runtime-config.js');
	expect(response.ok()).toBe(true);
	expect(await response.text()).toContain('window.__SAKALA_RUNTIME_CONFIG__ = {};');
});

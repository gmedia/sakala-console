import { expect, test, type Page } from '@playwright/test';

type UserMock = {
	id: number;
	name: string;
	email: string;
	avatar_url: string | null;
	role: string;
	onboarding_source: string;
	onboarding_completed_at: string | null;
	last_login_at: string;
};

const userCompletedOnboarding: UserMock = {
	id: 1,
	name: 'Test User',
	email: 'test@sakala.local',
	avatar_url: null,
	role: 'user',
	onboarding_source: 'github',
	onboarding_completed_at: new Date().toISOString(),
	last_login_at: new Date().toISOString()
};

const userPendingOnboarding: UserMock = {
	...userCompletedOnboarding,
	onboarding_completed_at: null
};

async function mockCurrentUserSuccess(page: Page, user: UserMock = userCompletedOnboarding) {
	await page.route('**/api/v1/auth/user', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ data: user })
		});
	});
}

async function mockCurrentUserError(page: Page, status = 401) {
	await page.route('**/api/v1/auth/user', async (route) => {
		await route.fulfill({
			status,
			contentType: 'application/json',
			body: JSON.stringify({ message: 'Unauthenticated', errors: {} })
		});
	});
}

async function mockCurrentUserNetworkError(page: Page) {
	await page.route('**/api/v1/auth/user', async (route) => {
		await route.abort('failed');
	});
}

test('redirects to /projects when onboarding is completed', async ({ page }) => {
	await mockCurrentUserSuccess(page, userCompletedOnboarding);

	await page.goto('/auth/github/callback');
	await page.waitForURL(/\/projects/, { timeout: 10000 });
	expect(new URL(page.url()).pathname).toBe('/projects');
});

test('redirects to /onboarding when onboarding is not completed', async ({ page }) => {
	await mockCurrentUserSuccess(page, userPendingOnboarding);

	await page.goto('/auth/github/callback');
	await page.waitForURL(/\/onboarding/, { timeout: 10000 });
	expect(new URL(page.url()).pathname).toBe('/onboarding');
});

test('redirects to saved valid return_url when present', async ({ page }) => {
	await mockCurrentUserSuccess(page, userCompletedOnboarding);

	await page.addInitScript(() => {
		localStorage.setItem('return_url', '/settings');
	});

	await page.goto('/auth/github/callback');
	await page.waitForURL(/\/settings/, { timeout: 10000 });
	expect(new URL(page.url()).pathname).toBe('/settings');
});

test('ignores invalid or malicious return_url and falls back to /projects', async ({ page }) => {
	await mockCurrentUserSuccess(page, userCompletedOnboarding);

	await page.addInitScript(() => {
		localStorage.setItem('return_url', '//example.com');
	});

	await page.goto('/auth/github/callback');
	await page.waitForURL(/\/projects/, { timeout: 10000 });
	expect(new URL(page.url()).pathname).toBe('/projects');
});

test('ignores backslash URL normalization open-redirect return_url', async ({ page }) => {
	await mockCurrentUserSuccess(page, userCompletedOnboarding);

	await page.addInitScript(() => {
		localStorage.setItem('return_url', '/\\example.com');
	});

	await page.goto('/auth/github/callback');
	await page.waitForURL(/\/projects/, { timeout: 10000 });
	expect(new URL(page.url()).pathname).toBe('/projects');
});

test('shows error message when provider returns error query parameter', async ({ page }) => {
	await page.goto('/auth/github/callback?error=github_access_denied');

	const heading = page.getByRole('heading', { name: 'Gagal Masuk' });
	await expect(heading).toBeVisible();
	await expect(heading).toBeFocused();
	await expect(page.getByText('Anda membatalkan izin masuk dengan GitHub.')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Coba Lagi' })).toBeVisible();
});

test('shows retry button for network failure during user session verification', async ({
	page
}) => {
	await mockCurrentUserNetworkError(page);

	await page.goto('/auth/github/callback');

	const heading = page.getByRole('heading', { name: 'Koneksi Terganggu' });
	await expect(heading).toBeVisible({ timeout: 15000 });
	await expect(heading).toBeFocused();
	await expect(page.getByRole('button', { name: 'Coba Lagi' })).toBeVisible();
});

test('shows re-login button for unauthenticated 401 response', async ({ page }) => {
	await mockCurrentUserError(page, 401);

	await page.goto('/auth/github/callback');

	const heading = page.getByRole('heading', { name: 'Autentikasi Gagal' });
	await expect(heading).toBeVisible({ timeout: 15000 });
	await expect(heading).toBeFocused();
	await expect(page.getByRole('link', { name: 'Kembali ke Login' })).toBeVisible();
});

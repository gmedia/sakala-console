import { expect, test, type Page } from '@playwright/test';

type UserMock = {
	id: number;
	name: string;
	username: string;
	email: string;
	avatar_url: string | null;
	role: string;
	onboarding_source: string | null;
	onboarding_role: string | null;
	onboarding_completed_at: string | null;
	last_login_at: string | null;
};

const userCompletedOnboarding: UserMock = {
	id: 1,
	name: 'Test User',
	username: 'testuser',
	email: 'test@sakala.local',
	avatar_url: null,
	role: 'user',
	onboarding_source: 'github',
	onboarding_role: 'developer',
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

test('shows "Terakhir Digunakan" badge when last_login_provider exists in localStorage', async ({
	page
}) => {
	await page.addInitScript(() => {
		localStorage.setItem('last_login_provider', 'google');
	});

	await page.goto('/login');

	const lastUsedBadge = page.getByText(/Terakhir Digunakan/);
	await expect(lastUsedBadge).toBeVisible();

	const googleButton = page.getByRole('button', { name: /Masuk akun dengan Google/ });
	await expect(googleButton).toBeVisible();

	const otherProfileButton = page.getByRole('button', { name: 'Masuk dengan profil lainnya' });
	await expect(otherProfileButton).toBeVisible();

	await otherProfileButton.click();
	await expect(page.getByRole('button', { name: /Masuk akun dengan Github/ })).toBeVisible();
	await expect(page.getByRole('button', { name: /Masuk akun dengan Email/ })).toBeVisible();
});

test('renders register page with Nama Lengkap field in email registration mode', async ({
	page
}) => {
	await page.goto('/register?method=email');

	await expect(page.getByRole('heading', { name: 'Daftar Dengan Email' })).toBeVisible();
	await expect(page.getByLabel('Nama Lengkap')).toBeVisible();
	await expect(page.getByLabel('Email')).toBeVisible();
	await expect(page.getByLabel('Kata Sandi', { exact: true })).toBeVisible();
	await expect(page.getByLabel('Konfirmasi Kata Sandi', { exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Buat Akun' })).toBeVisible();
});

test('redirects to saved valid return_url after Google login via /dashboard and records last_login_provider', async ({
	page
}) => {
	await mockCurrentUserSuccess(page, userCompletedOnboarding);

	await page.addInitScript(() => {
		localStorage.setItem('pending_oauth_provider', 'google');
		localStorage.setItem('return_url', '/settings');
	});

	await page.goto('/dashboard');
	await page.waitForURL(/\/settings/, { timeout: 10000 });
	expect(new URL(page.url()).pathname).toBe('/settings');

	await expect
		.poll(() => page.evaluate(() => localStorage.getItem('last_login_provider')))
		.toBe('google');

	await expect
		.poll(() => page.evaluate(() => localStorage.getItem('pending_oauth_provider')))
		.toBeNull();

	const returnUrl = await page.evaluate(() => localStorage.getItem('return_url'));
	expect(returnUrl).toBeNull();
});

test('redirects to /projects after Google login when return_url is missing and records last_login_provider', async ({
	page
}) => {
	await mockCurrentUserSuccess(page, userCompletedOnboarding);

	await page.addInitScript(() => {
		localStorage.setItem('pending_oauth_provider', 'google');
	});

	await page.goto('/dashboard');
	await page.waitForURL(/\/projects/, { timeout: 10000 });
	expect(new URL(page.url()).pathname).toBe('/projects');

	await expect
		.poll(() => page.evaluate(() => localStorage.getItem('last_login_provider')))
		.toBe('google');

	await expect
		.poll(() => page.evaluate(() => localStorage.getItem('pending_oauth_provider')))
		.toBeNull();
});

test('ignores invalid return_url after Google login and falls back to /projects', async ({
	page
}) => {
	await mockCurrentUserSuccess(page, userCompletedOnboarding);

	await page.addInitScript(() => {
		localStorage.setItem('pending_oauth_provider', 'google');
		localStorage.setItem('return_url', '//example.com');
	});

	await page.goto('/dashboard');
	await page.waitForURL(/\/projects/, { timeout: 10000 });
	expect(new URL(page.url()).pathname).toBe('/projects');

	const returnUrl = await page.evaluate(() => localStorage.getItem('return_url'));
	expect(returnUrl).toBeNull();
});

test('does not promote pending_oauth_provider when /dashboard is visited unauthenticated', async ({
	page
}) => {
	await mockCurrentUserError(page, 401);

	await page.addInitScript(() => {
		localStorage.setItem('pending_oauth_provider', 'google');
	});

	await page.goto('/dashboard');
	await page.waitForURL(/\/login/, { timeout: 10000 });

	const lastProvider = await page.evaluate(() => localStorage.getItem('last_login_provider'));
	expect(lastProvider).toBeNull();

	const pendingProvider = await page.evaluate(() => localStorage.getItem('pending_oauth_provider'));
	expect(pendingProvider).toBeNull();
});

test('does not clear pending_oauth_provider on transient network error during verification', async ({
	page
}) => {
	await mockCurrentUserNetworkError(page);

	await page.addInitScript(() => {
		localStorage.setItem('pending_oauth_provider', 'google');
	});

	await page.goto('/dashboard');
	await page.waitForURL(/\/projects/, { timeout: 10000 });

	await expect(page.getByText('Tidak ada koneksi internet')).toBeVisible({ timeout: 15000 });

	const pendingProvider = await page.evaluate(() => localStorage.getItem('pending_oauth_provider'));
	expect(pendingProvider).toBe('google');

	const lastProvider = await page.evaluate(() => localStorage.getItem('last_login_provider'));
	expect(lastProvider).toBeNull();
});

test('does not set last_login_provider when Google login is cancelled or fails', async ({
	page
}) => {
	await page.addInitScript(() => {
		localStorage.setItem('pending_oauth_provider', 'google');
		localStorage.setItem('return_url', '/settings');
	});

	await page.goto('/login?error=google_access_denied');

	await expect(page.getByText('Anda membatalkan izin masuk dengan Google.')).toBeVisible();
	await expect(page.getByText(/Terakhir Digunakan/)).not.toBeVisible();

	const lastProvider = await page.evaluate(() => localStorage.getItem('last_login_provider'));
	expect(lastProvider).toBeNull();

	const pendingProvider = await page.evaluate(() => localStorage.getItem('pending_oauth_provider'));
	expect(pendingProvider).toBeNull();
});

test('does not set last_login_provider when GitHub login is cancelled or fails', async ({
	page
}) => {
	await page.addInitScript(() => {
		localStorage.setItem('pending_oauth_provider', 'github');
		localStorage.setItem('return_url', '/settings');
	});

	await page.goto('/auth/github/callback?error=github_access_denied');

	const lastProvider = await page.evaluate(() => localStorage.getItem('last_login_provider'));
	expect(lastProvider).toBeNull();

	const heading = page.getByRole('heading', { name: 'Gagal Masuk' });
	await expect(heading).toBeVisible();
});

test('sets last_login_provider to github only after successful authentication in GitHub callback', async ({
	page
}) => {
	await mockCurrentUserSuccess(page, userCompletedOnboarding);

	await page.addInitScript(() => {
		localStorage.setItem('pending_oauth_provider', 'github');
	});

	await page.goto('/auth/github/callback');
	await page.waitForURL(/\/projects/, { timeout: 10000 });
	expect(new URL(page.url()).pathname).toBe('/projects');

	const lastProvider = await page.evaluate(() => localStorage.getItem('last_login_provider'));
	expect(lastProvider).toBe('github');
});

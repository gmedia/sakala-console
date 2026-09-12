import { expect, test, type Page } from '@playwright/test';

const validUser = {
	id: 1,
	name: 'Test User',
	email: 'test@sakala.local',
	avatar_url: null,
	role: 'user',
	onboarding_source: 'github',
	onboarding_completed_at: new Date().toISOString(),
	last_login_at: new Date().toISOString()
};

async function mockCurrentUserSuccess(page: Page, delayMs = 0) {
	await page.route('**/api/v1/auth/user', async (route) => {
		if (delayMs > 0) {
			await new Promise((resolve) => setTimeout(resolve, delayMs));
		}
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ data: validUser })
		});
	});
}

async function mockCurrentUserError(page: Page, status: number) {
	await page.route('**/api/v1/auth/user', async (route) => {
		await route.fulfill({
			status,
			contentType: 'application/json',
			body: JSON.stringify({ message: 'mocked error', errors: {} })
		});
	});
}

async function mockCurrentUserNetworkError(page: Page) {
	await page.route('**/api/v1/auth/user', async (route) => {
		await route.abort('failed');
	});
}

test('shows the honest foundation state', async ({ page }) => {
	await page.goto('/');

	await expect(page.getByRole('heading', { level: 1 })).toContainText('Build');
});

test('keeps deep links available through the static SPA fallback', async ({ page }) => {
	await mockCurrentUserSuccess(page);

	await page.goto('/projects');

	await expect(page.getByRole('heading', { name: 'Projects' }).first()).toBeVisible();
	await expect(page.getByRole('navigation', { name: 'Navigasi utama' })).toBeVisible();
});

test('redirects to login with a safe returnTo on 401', async ({ page }) => {
	const pageErrors: Error[] = [];
	page.on('pageerror', (error) => pageErrors.push(error));

	await mockCurrentUserError(page, 401);

	await page.goto('/projects?tab=logs');
	await page.waitForURL(/\/login/, { timeout: 5000 });

	const url = new URL(page.url());
	expect(url.pathname).toBe('/login');
	expect(decodeURIComponent(url.searchParams.get('returnTo') ?? '')).toBe('/projects?tab=logs');
	expect(pageErrors).toHaveLength(0);
});

test('does NOT redirect to login on 403 user stay and sees a error state', async ({ page }) => {
	await mockCurrentUserError(page, 403);

	await page.goto('/projects');

	await expect(page).toHaveURL('/projects');
	await expect(page.getByText('Anda tidak memiliki akses')).toBeVisible({ timeout: 15000 });
});

test('does NOT redirect to login on network failure, user stay and sees a error state', async ({
	page
}) => {
	await mockCurrentUserNetworkError(page);
	await page.goto('/projects');

	await expect(page).toHaveURL('/projects');
	await expect(page.getByText('Tidak ada koneksi internet')).toBeVisible({ timeout: 15000 });
});

test('does NOT render protected content while current user is still pending', async ({ page }) => {
	await mockCurrentUserSuccess(page, 500);

	await page.goto('/projects');

	await expect(page.getByRole('heading', { name: 'Projects' })).not.toBeVisible();
	await expect(page.getByRole('status', { name: /memuat/i })).toBeVisible();

	await expect(page.getByRole('heading', { name: 'Projects' }).first()).toBeVisible();
});

test.describe('Deployment detail page', () => {
	test('shows running state', async ({ page }) => {
		await mockCurrentUserSuccess(page);
		await page.goto('/projects/sakala-console/deployments/12?status=running');

		await expect(page.getByText('Deployment sedang berjalan')).toBeVisible();
		await expect(page.getByText(/Tahap: Building image/)).toBeVisible();

		const deploymentInfo = page.getByTestId('deployment-info');

		await expect(deploymentInfo.getByText('Dimulai pada')).toBeVisible();
		await expect(deploymentInfo.getByText('08:41:02')).toBeVisible();
		await expect(deploymentInfo.getByText('main', { exact: true })).toBeVisible();
		await expect(deploymentInfo.getByText('Push', { exact: true })).toBeVisible();
		await expect(deploymentInfo.getByText('a3f2c9d', { exact: true })).toBeVisible();

		await expect(page.getByText('Cloning repository', { exact: true })).toBeVisible();
		await expect(page.getByText('Sedang berjalan...')).toBeVisible();
		await expect(page.getByText('Cloning repository from main...')).toBeVisible();
	});

	test('shows success state', async ({ page }) => {
		await mockCurrentUserSuccess(page);
		await page.goto('/projects/sakala-console/deployments/12?status=success');

		await expect(page.getByText('Deployment berhasil')).toBeVisible();

		const deploymentInfo = page.getByTestId('deployment-info');

		await expect(deploymentInfo.getByText('Selesai pada')).toBeVisible();
		await expect(deploymentInfo.getByText('08:41:49')).toBeVisible();
		await expect(deploymentInfo.getByText('Manual redeploy', { exact: true })).toBeVisible();

		await expect(page.getByText('Health check', { exact: true })).toBeVisible();
		await expect(page.getByText('Deployment is live')).toBeVisible();
	});

	test('shows failed state', async ({ page }) => {
		await mockCurrentUserSuccess(page);
		await page.goto('/projects/sakala-console/deployments/12?status=failed');

		await expect(page.getByText('Deployment gagal')).toBeVisible();

		const deploymentInfo = page.getByTestId('deployment-info');

		await expect(deploymentInfo.getByText('Gagal pada')).toBeVisible();
		await expect(deploymentInfo.getByText('08:39:12')).toBeVisible();

		await expect(page.getByText('Building image - gagal')).toBeVisible();
		await expect(page.getByText(/Build failed: see step 5 output above/)).toBeVisible();
	});
});

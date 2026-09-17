import { expect, test, type Page } from '@playwright/test';

const validUser = {
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

const validProject = {
	id: 'proj_1',
	name: 'Sakala Console',
	repository_full_name: 'gmedia/sakala-console',
	repository_source: 'github_installation',
	github_installation_id: '123',
	github_repository_id: '456',
	branch: 'main',
	thumbnail_url: 'https://example.com/thumb.png',
	runtime_status: 'running',
	last_deployed_at: '2026-09-10T10:00:00Z',
	created_at: '2026-01-01T00:00:00Z'
};

function buildProjectsResponse(
	overrides: Partial<{
		data: (typeof validProject)[];
		meta: Record<string, unknown>;
	}> = {}
) {
	return {
		data: overrides.data ?? [],
		links: { first: null, last: null, prev: null, next: null },
		meta: {
			current_page: 1,
			from: null,
			last_page: 1,
			links: [],
			path: null,
			per_page: 6,
			to: null,
			total: overrides.data?.length ?? 0,
			...overrides.meta
		}
	};
}

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

async function mockProjectsSuccess(page: Page, response: ReturnType<typeof buildProjectsResponse>) {
	await page.route('**/api/v1/app/projects**', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(response)
		});
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

test.describe('Projects list page', () => {
	test('shows empty state when no projects exist', async ({ page }) => {
		await mockCurrentUserSuccess(page);
		await mockProjectsSuccess(page, buildProjectsResponse({ data: [] }));

		await page.goto('/projects');

		await expect(page.getByText('Belum ada proyek')).toBeVisible();
		await expect(page.getByRole('link', { name: /baca panduan deploy pertamamu/i })).toBeVisible();
	});

	test('shows empty state when search results are empty', async ({ page }) => {
		await mockCurrentUserSuccess(page);
		await mockProjectsSuccess(
			page,
			buildProjectsResponse({
				data: [],
				meta: { total: 5 }
			})
		);

		await page.goto('/projects');

		await expect(page.getByText('Tidak menemukan project')).toBeVisible();
	});

	test('shows project list', async ({ page }) => {
		await mockCurrentUserSuccess(page);
		await mockProjectsSuccess(
			page,
			buildProjectsResponse({ data: [validProject], meta: { total: 1 } })
		);

		await page.goto('/projects');

		await expect(page.getByText(validProject.name, { exact: true })).toBeVisible();
	});

	test('shows error state and retry when loading fails', async ({ page }) => {
		await mockCurrentUserSuccess(page);

		let requestCount = 0;

		await page.route('**/api/v1/app/projects**', async (route) => {
			requestCount++;

			if (requestCount === 1) {
				await route.fulfill({
					status: 500,
					contentType: 'application/json',
					body: JSON.stringify({
						message: 'mocked error',
						errors: {}
					})
				});
				return;
			}

			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(
					buildProjectsResponse({
						data: [validProject],
						meta: {
							current_page: 1,
							last_page: 1,
							total: 1
						}
					})
				)
			});
		});

		await page.goto('/projects');

		await expect(page.getByText('Gagal memuat project')).toBeVisible();

		await page.getByRole('button', { name: /coba lagi/i }).click();

		await expect.poll(() => requestCount).toBe(2);

		await expect(page.getByText(validProject.name, { exact: true })).toBeVisible();
	});

	test('shows pagination when there are multiple pages', async ({ page }) => {
		await mockCurrentUserSuccess(page);

		const page1Projects = [{ ...validProject, id: 'proj_1', name: 'Project Satu' }];
		const page2Projects = [{ ...validProject, id: 'proj_2', name: 'Project Dua' }];

		await page.route('**/api/v1/app/projects**', async (route) => {
			const url = new URL(route.request().url());
			const currentPage = Number(url.searchParams.get('page') ?? '1');

			const response = buildProjectsResponse({
				data: currentPage === 2 ? page2Projects : page1Projects,
				meta: {
					current_page: currentPage,
					last_page: 2,
					total: 7,
					per_page: 6
				}
			});

			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(response)
			});
		});

		await page.goto('/projects');

		await expect(page.getByText('Project Satu')).toBeVisible();

		await page.getByRole('button', { name: /next page|next/i }).click();

		await expect(page.getByText('Project Dua')).toBeVisible();
		await expect(page.getByText('Project Satu')).not.toBeVisible();
	});

	test('does not show pagination when there is only one page', async ({ page }) => {
		await mockCurrentUserSuccess(page);
		await mockProjectsSuccess(
			page,
			buildProjectsResponse({ data: [validProject], meta: { total: 1, last_page: 1 } })
		);

		await page.goto('/projects');

		await expect(page.getByRole('navigation', { name: /pagination/i })).not.toBeVisible();
	});
});

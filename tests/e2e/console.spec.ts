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
	github_repository_id: 456,
	branch: 'main',
	thumbnail_url: 'https://example.com/thumb.png',
	runtime_status: 'running',
	last_deployed_at: '2026-09-10T10:00:00Z',
	created_at: '2026-01-01T00:00:00Z'
};

const PROJECT_ID = '01a0cd45-c5a6-7170-9f8d-8322191f231f';
const DEPLOYMENT_ID = '01a0cd92-b2e0-7327-97a1-d688062f30fa';

type DeploymentStatus = 'running' | 'succeeded' | 'failed';

function makeDeployment(status: DeploymentStatus) {
	const base = {
		id: '12',
		project_id: 'proj_1',
		sequence: 1,
		branch: 'main',
		trigger: 'push',
		commit_sha: 'a3f2c9d',
		commit_message: 'feat: something',
		image_reference: null,
		requested_resources: null,
		effective_resources: null,
		applied_resources: null,
		finalization_deferred: false,
		finalization_deferred_reason: '',
		agent_node_id: null,
		failure_code: null,
		failure_summary: null,
		failure: null,
		created_at: '2026-09-20T08:41:00Z',
		updated_at: '2026-09-20T08:41:49Z'
	};

	if (status === 'running') {
		return {
			...base,
			status: 'building',
			trigger: 'webhook',
			started_at: '2026-09-20T08:41:02Z',
			finished_at: null,
			cancelled_at: null
		};
	}

	if (status === 'succeeded') {
		return {
			...base,
			status: 'succeeded',
			trigger: 'redeploy',
			started_at: '2026-09-20T08:41:02Z',
			finished_at: '2026-09-20T08:41:49Z',
			cancelled_at: null
		};
	}

	return {
		...base,
		status: 'failed',
		started_at: '2026-09-20T08:38:00Z',
		finished_at: '2026-09-20T08:39:12Z',
		cancelled_at: null,
		failure_code: 'runtime_build_failed',
		failure_summary: 'Build failed: see step 5 output above',
		failure: {
			code: 'runtime_build_failed',
			category: 'build',
			summary: 'Build failed: see step 5 output above',
			recovery_hint: 'Periksa konfigurasi build'
		}
	};
}

async function mockDeploymentDetail(page: Page, status: DeploymentStatus) {
	await page.route('**/api/v1/app/projects/**', async (route) => {
		const url = new URL(route.request().url());
		const path = url.pathname;

		if (/\/deployments\/[^/]+\/events\/?$/.test(path)) {
			const events =
				status === 'running'
					? [
							{
								sequence: 1,
								level: 'info',
								type: 'deployment.queued',
								message: 'Deployment queued',
								metadata: null,
								occurred_at: '2026-09-20T08:40:00Z'
							},
							{
								sequence: 2,
								level: 'info',
								type: 'deployment.cloning',
								message: 'Cloning repository from main...',
								metadata: null,
								occurred_at: '2026-09-20T08:41:02Z'
							},
							{
								sequence: 3,
								level: 'info',
								type: 'deployment.analyzing',
								message: 'Analyzing project...',
								metadata: null,
								occurred_at: '2026-09-20T08:41:20Z'
							},
							{
								sequence: 4,
								level: 'info',
								type: 'deployment.building',
								message: 'Building image...',
								metadata: null,
								occurred_at: '2026-09-20T08:41:35Z'
							}
						]
					: status === 'succeeded'
						? [
								{
									sequence: 1,
									level: 'info',
									type: 'deployment.succeeded',
									message: 'Deployment is live',
									metadata: null,
									occurred_at: '2026-09-20T08:41:49Z'
								}
							]
						: [
								{
									sequence: 1,
									level: 'info',
									type: 'deployment.queued',
									message: 'Deployment queued',
									metadata: null,
									occurred_at: '2026-09-20T08:38:00Z'
								},
								{
									sequence: 2,
									level: 'info',
									type: 'deployment.cloning',
									message: 'Cloning repository from main...',
									metadata: null,
									occurred_at: '2026-09-20T08:38:15Z'
								},
								{
									sequence: 3,
									level: 'info',
									type: 'deployment.building',
									message: 'Building image...',
									metadata: null,
									occurred_at: '2026-09-20T08:38:30Z'
								},
								{
									sequence: 4,
									level: 'error',
									type: 'deployment.failed',
									message: 'Build failed: see step 5 output above',
									metadata: null,
									occurred_at: '2026-09-20T08:39:12Z'
								}
							];

			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					data: events,
					links: { first: null, last: null, prev: null, next: null },
					meta: {
						path: null,
						per_page: 30,
						next_cursor: null,
						prev_cursor: null
					}
				})
			});
			return;
		}

		if (/\/deployments\/[^/]+\/?$/.test(path)) {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ data: makeDeployment(status) })
			});
			return;
		}

		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				data: {
					id: 'proj_1',
					name: 'Sakala Console',
					slug: 'sakala-console',
					default_domain: 'sakala-console.run.staging.sakala.dev'
				}
			})
		});
	});
}

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

async function mockProjects(
	page: Page,
	resolver: (url: URL) => ReturnType<typeof buildProjectsResponse>
) {
	await page.route('**/api/v1/app/projects**', async (route) => {
		const url = new URL(route.request().url());
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(resolver(url))
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
		await mockDeploymentDetail(page, 'running');
		await page.goto(`/projects/${PROJECT_ID}/deployments/${DEPLOYMENT_ID}`);

		await expect(page.getByText('Deployment sedang berjalan')).toBeVisible();
		await page.waitForTimeout(2000);
		await expect(page.getByText(/Tahap: Building image/)).toBeVisible();

		const deploymentInfo = page.getByTestId('deployment-info');
		await expect(deploymentInfo.getByText('Dimulai pada')).toBeVisible();
		await expect(page.getByTestId('deployment-primary-time')).toHaveText(
			/^\d{2}[:.]\d{2}[:.]\d{2}$/
		);
		await expect(page.getByTestId('deployment-updated-time')).toHaveText(
			/^\d{2}[:.]\d{2}[:.]\d{2}$/
		);

		await expect(page.getByTestId('deployment-commit')).toHaveText('a3f2c9d');
		await expect(page.getByTestId('deployment-branch')).toHaveText('main');
		await expect(page.getByTestId('deployment-trigger')).toHaveText('Push');

		await expect(page.getByText(/Cloning repository from main\.\.\./)).toBeVisible();
		await expect(page.getByText('Sedang berjalan...')).toBeVisible();
		await expect(page.getByText('Cloning repository from main...')).toBeVisible();
	});

	test('shows success state', async ({ page }) => {
		await mockCurrentUserSuccess(page);
		await mockDeploymentDetail(page, 'succeeded');
		await page.goto('/projects/sakala-console/deployments/12');

		await expect(page.getByText('Deployment berhasil')).toBeVisible();

		const deploymentInfo = page.getByTestId('deployment-info');

		await expect(deploymentInfo.getByText('Selesai pada')).toBeVisible();
		await expect(page.getByTestId('deployment-primary-time')).toHaveText(
			/^\d{2}[:.]\d{2}[:.]\d{2}$/
		);
		await expect(page.getByTestId('deployment-trigger')).toHaveText('Manual redeploy');

		await expect(page.getByText('Health check - live', { exact: true })).toBeVisible();
	});

	test('shows failed state', async ({ page }) => {
		await mockCurrentUserSuccess(page);
		await mockDeploymentDetail(page, 'failed');
		await page.goto('/projects/sakala-console/deployments/12');

		await expect(page.getByText('Deployment gagal')).toBeVisible();

		const deploymentInfo = page.getByTestId('deployment-info');

		await expect(deploymentInfo.getByText('Gagal pada')).toBeVisible();
		await expect(page.getByTestId('deployment-primary-time')).toHaveText(
			/^\d{2}[:.]\d{2}[:.]\d{2}$/
		);

		await expect(page.getByText('Building image - gagal')).toBeVisible();
		await expect(page.getByText(/Build failed: see step 5 output above/)).toBeVisible();
	});
});

test.describe('Projects list page', () => {
	test('shows empty state when no projects exist', async ({ page }) => {
		await mockCurrentUserSuccess(page);
		await mockProjects(page, () => buildProjectsResponse({ data: [] }));

		await page.goto('/projects');

		await expect(page.getByText('Belum ada proyek')).toBeVisible();
		await expect(page.getByRole('link', { name: /baca panduan deploy pertamamu/i })).toBeVisible();
	});

	test('shows "tidak menemukan" when active date filter excludes existing projects', async ({
		page
	}) => {
		await mockCurrentUserSuccess(page);
		await mockProjects(page, (url) => {
			const isProbe = url.searchParams.get('per_page') === '1';
			return isProbe
				? buildProjectsResponse({ data: [validProject] })
				: buildProjectsResponse({ data: [] });
		});

		await page.goto('/projects');

		await expect(page.getByText('Tidak menemukan project')).toBeVisible();
		await expect(page.getByText('Belum ada proyek')).not.toBeVisible();
	});

	test('shows "tidak menemukan" when a search term matches nothing', async ({ page }) => {
		await mockCurrentUserSuccess(page);

		await mockProjects(page, (url) => {
			if (url.searchParams.get('per_page') === '1') {
				return buildProjectsResponse({
					data: [validProject]
				});
			}

			if (url.searchParams.get('search')) {
				return buildProjectsResponse({
					data: [],
					meta: {
						total: 0
					}
				});
			}

			return buildProjectsResponse({
				data: [validProject],
				meta: {
					total: 1
				}
			});
		});

		await page.goto('/projects');

		await expect(page.getByText(validProject.name, { exact: true })).toBeVisible();

		await page.getByPlaceholder('Cari..').fill('project-yang-tidak-ada');

		await expect(page.getByText('Tidak menemukan project')).toBeVisible();
		await expect(page.getByText('Belum ada proyek')).not.toBeVisible();
	});

	test('shows project list', async ({ page }) => {
		await mockCurrentUserSuccess(page);
		await mockProjects(page, () =>
			buildProjectsResponse({ data: [validProject], meta: { total: 1 } })
		);

		await page.goto('/projects');

		await expect(page.getByText(validProject.name, { exact: true })).toBeVisible();
	});

	test('shows server error state and retries when loading fails', async ({ page }) => {
		await mockCurrentUserSuccess(page);

		let projectRequestCount = 0;

		await page.route('**/api/v1/app/projects**', async (route) => {
			const url = new URL(route.request().url());
			const isProbe = url.searchParams.get('per_page') === '1';

			if (isProbe) {
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
				return;
			}

			projectRequestCount++;

			if (projectRequestCount === 1) {
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

		await expect(page.getByText('Server sedang bermasalah')).toBeVisible();

		await expect(
			page.getByText('Terjadi masalah pada server saat mengambil data project. Silakan coba lagi.')
		).toBeVisible();

		await page.getByRole('button', { name: /coba lagi/i }).click();

		await expect.poll(() => projectRequestCount).toBe(2);

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

	test('shows a visible fetching state while paginating, without silently presenting stale data as fresh', async ({
		page
	}) => {
		await mockCurrentUserSuccess(page);

		const page1Projects = [{ ...validProject, id: 'proj_1', name: 'Project Satu' }];
		const page2Projects = [{ ...validProject, id: 'proj_2', name: 'Project Dua' }];

		const gate: { release: (() => void) | null } = { release: null };

		await page.route('**/api/v1/app/projects**', async (route) => {
			const url = new URL(route.request().url());
			const currentPage = Number(url.searchParams.get('page') ?? '1');

			if (currentPage === 2) {
				await new Promise<void>((resolve) => {
					gate.release = resolve;
				});
			}

			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(
					buildProjectsResponse({
						data: currentPage === 2 ? page2Projects : page1Projects,
						meta: { current_page: currentPage, last_page: 2, total: 7, per_page: 6 }
					})
				)
			});
		});

		await page.goto('/projects');
		await expect(page.getByText('Project Satu')).toBeVisible();

		const list = page.getByRole('region', { name: 'List Projects' });
		await expect(list).toHaveAttribute('aria-busy', 'false');

		await page.getByRole('button', { name: /next page|next/i }).click();

		await expect(list).toHaveAttribute('aria-busy', 'true');
		await expect(page.getByRole('button', { name: /next page|next/i })).toBeDisabled();
		await expect(page.getByText('Project Satu')).toBeVisible();
		await expect(page.getByText('Project Dua')).not.toBeVisible();

		gate.release?.();

		await expect(page.getByText('Project Dua')).toBeVisible();
		await expect(list).toHaveAttribute('aria-busy', 'false');
	});

	test('navigates to project detail when clicking lihat detail', async ({ page }) => {
		await mockCurrentUserSuccess(page);

		await mockProjects(page, () =>
			buildProjectsResponse({
				data: [validProject],
				meta: {
					total: 1
				}
			})
		);

		await page.goto('/projects');

		await expect(page.getByText(validProject.name, { exact: true })).toBeVisible();

		await page.getByRole('link', { name: /lihat detail/i }).click();

		await expect(page).toHaveURL(`/projects/${validProject.id}/deployments`);
	});

	test('logout dialog handles accessibility focus trap and escape key', async ({ page }) => {
		await mockCurrentUserSuccess(page);
		await mockProjects(page, () =>
			buildProjectsResponse({
				data: [],
				meta: {
					total: 0
				}
			})
		);

		await page.goto('/projects');

		const profileTrigger = page.getByRole('button', { name: 'Menu akun pengguna' });
		await expect(profileTrigger).toBeVisible();
		await profileTrigger.click();

		const logoutMenuItem = page.getByRole('button', { name: 'Keluar' });
		await expect(logoutMenuItem).toBeVisible();
		await logoutMenuItem.click();

		const logoutDialog = page.getByRole('dialog');
		await expect(logoutDialog).toBeVisible();

		const cancelButton = page.getByRole('button', { name: 'Tidak' });
		const confirmButton = page.getByRole('button', { name: 'Iya' });

		await expect(cancelButton).toBeFocused();

		await page.keyboard.press('Tab');
		await expect(confirmButton).toBeFocused();

		await page.keyboard.press('Tab');
		await expect(cancelButton).toBeFocused();

		await page.keyboard.press('Shift+Tab');
		await expect(confirmButton).toBeFocused();

		await page.keyboard.press('Escape');
		await expect(logoutDialog).not.toBeVisible();
		await expect(profileTrigger).toBeFocused();
	});

	test('mobile drawer profile dropdown stays open and accessible when clicked', async ({
		page
	}) => {
		await mockCurrentUserSuccess(page);
		await mockProjects(page, () =>
			buildProjectsResponse({
				data: [],
				meta: { total: 0 }
			})
		);

		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto('/projects');

		const openNavButton = page.getByRole('button', { name: 'Buka navigasi' });
		await expect(openNavButton).toBeVisible();
		await openNavButton.click();

		const mobileNav = page.getByRole('navigation', { name: 'Navigasi mobile' });
		await expect(mobileNav).toBeVisible();

		const profileTrigger = mobileNav.getByRole('button', { name: 'Menu akun pengguna' });
		await expect(profileTrigger).toBeVisible();
		await profileTrigger.click();

		await expect(mobileNav.getByRole('link', { name: 'Lihat Profil' })).toBeVisible();
		await expect(mobileNav.getByRole('link', { name: 'Pengaturan' })).toBeVisible();
		await expect(mobileNav.getByRole('button', { name: 'Keluar' })).toBeVisible();
	});

	test('logout dialog displays error and allows retry when logout request fails', async ({
		page
	}) => {
		await mockCurrentUserSuccess(page);
		await mockProjects(page, () => buildProjectsResponse({ data: [], meta: { total: 0 } }));

		await page.route('**/sanctum/csrf-cookie', async (route) => {
			await route.fulfill({ status: 204 });
		});

		let logoutIntercepted = false;

		await page.route('**/api/v1/auth/logout', async (route) => {
			logoutIntercepted = true;
			await route.fulfill({
				status: 500,
				contentType: 'application/json',
				body: JSON.stringify({ message: 'Internal Server Error' })
			});
		});

		await page.goto('/projects');

		const profileTrigger = page.getByRole('button', { name: 'Menu akun pengguna' });
		await expect(profileTrigger).toBeVisible();
		await profileTrigger.click();

		await page.getByRole('button', { name: 'Keluar' }).click();

		const logoutDialog = page.getByRole('dialog');
		await expect(logoutDialog).toBeVisible();

		await logoutDialog.getByRole('button', { name: 'Iya' }).click();

		await expect.poll(() => logoutIntercepted, { timeout: 5_000 }).toBe(true);

		await expect(logoutDialog.getByRole('button', { name: 'Coba Lagi' })).toBeVisible({
			timeout: 5_000
		});
		await expect(logoutDialog.getByText('Gagal keluar akun. Silakan coba lagi.')).toBeVisible();
	});
});

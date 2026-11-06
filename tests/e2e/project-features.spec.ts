import { expect, test, type Page } from '@playwright/test';
import { baseProject, DEPLOYMENT_ID, mockProjectApi, PROJECT_ID } from './fixtures/project-detail';
import { mockWizardApi, pilotLimits } from './fixtures/create-project';

const SETTINGS_URL = `/projects/${PROJECT_ID}/settings`;

test.describe('project settings: build configuration (U-50, U-60, U-64)', () => {
	test('no field says "Belum tersedia", and the help tells Dockerfile from auto builds', async ({
		page
	}) => {
		await mockProjectApi(page);
		await page.goto(SETTINGS_URL);

		await expect(page.getByLabel('Build command')).toBeEditable();
		await expect(page.getByText('Belum tersedia')).toHaveCount(0);
		await expect(page.getByLabel('Build command')).toHaveAccessibleDescription(
			/Hanya dipakai saat build otomatis dengan Railpack/
		);
		await expect(page.getByLabel('Start command')).toHaveAccessibleDescription(
			/Berlaku untuk Dockerfile dan Railpack/
		);
		await expect(page.getByLabel('Port')).toHaveAccessibleDescription(/Sekarang 3000/);
	});

	test('saves only the fields that changed, and null clears one', async ({ page }) => {
		const updates: unknown[] = [];
		await mockProjectApi(page, {
			project: () => ({
				...baseProject,
				configured_port: 8080,
				effective_port: 8080,
				build_command: 'pnpm build'
			}),
			updateProject: (body) => {
				updates.push(body);
				return { body: { data: { ...baseProject, ...body } } };
			}
		});
		await page.goto(SETTINGS_URL);

		await expect(page.getByLabel('Port')).toHaveValue('8080');
		await page.getByLabel('Port').fill('');
		await page.getByLabel('Start command').fill('node server.js');
		await page.getByRole('button', { name: 'Simpan perubahan' }).click();

		await expect(page.getByText(/Berlaku mulai deployment berikutnya/)).toBeVisible();
		expect(updates).toEqual([{ configured_port: null, start_command: 'node server.js' }]);
	});

	test('changing the root directory asks for a new inspection', async ({ page }) => {
		let inspections = 0;
		await mockProjectApi(page);
		await page.route(`**/api/v1/app/projects/${PROJECT_ID}/inspection`, (route) => {
			inspections += 1;
			return route.fulfill({
				status: 202,
				contentType: 'application/json',
				body: JSON.stringify({ data: { ...baseProject, preview_status: 'pending' } })
			});
		});
		await page.goto(SETTINGS_URL);

		await page.getByLabel('Root Directory').fill('apps/web');
		await page.getByRole('button', { name: 'Simpan perubahan' }).click();

		await expect.poll(() => inspections).toBe(1);
	});

	test('an invalid value is refused before the request, on its field', async ({ page }) => {
		let updates = 0;
		await mockProjectApi(page, {
			updateProject: () => {
				updates += 1;
				return { body: { data: baseProject } };
			}
		});
		await page.goto(SETTINGS_URL);

		await page.getByLabel('Port').fill('99999');
		await page.getByRole('button', { name: 'Simpan perubahan' }).click();

		await expect(page.getByLabel('Port')).toHaveAccessibleDescription(/1 sampai 65535/);
		expect(updates).toBe(0);
	});

	test('a 422 lands on its field and keeps the draft', async ({ page }) => {
		await mockProjectApi(page, {
			updateProject: () => ({
				status: 422,
				body: {
					message: 'Ditolak',
					errors: { root_directory: ['Direktori root harus berupa path relatif.'] }
				}
			})
		});
		await page.goto(SETTINGS_URL);

		await page.getByLabel('Root Directory').fill('apps/web');
		await page.getByRole('button', { name: 'Simpan perubahan' }).click();

		await expect(page.getByLabel('Root Directory')).toHaveAccessibleDescription(
			'Direktori root harus berupa path relatif.'
		);
		await expect(page.getByLabel('Root Directory')).toHaveValue('apps/web');
	});

	test('the draft of a build setting survives a tab switch, and Redeploy saves it', async ({
		page
	}) => {
		const calls: string[] = [];
		await mockProjectApi(page, {
			updateProject: (body) => {
				calls.push(`PUT ${JSON.stringify(body)}`);
				return { body: { data: { ...baseProject, ...body } } };
			},
			redeploy: () => {
				calls.push('POST');
				return { status: 201, body: { data: { id: DEPLOYMENT_ID } } };
			}
		});
		await page.goto(SETTINGS_URL);

		await page.getByLabel('Build command').fill('pnpm build');
		await page.getByRole('link', { name: 'Environment Variables' }).click();
		await page.getByRole('link', { name: 'Pengaturan', exact: true }).click();
		await expect(page.getByLabel('Build command')).toHaveValue('pnpm build');

		await page.getByRole('button', { name: 'Redeploy' }).click();

		await expect.poll(() => calls).toEqual(['PUT {"build_command":"pnpm build"}', 'POST']);
	});

	test('auto-deploy saves for a GitHub installation, and says it needs the webhook', async ({
		page
	}) => {
		const updates: unknown[] = [];
		await mockProjectApi(page, {
			project: () => ({ ...baseProject, auto_deploy: false }),
			updateProject: (body) => {
				updates.push(body);
				return { body: { data: { ...baseProject, ...body } } };
			}
		});
		await page.goto(SETTINGS_URL);

		const toggle = page.getByRole('switch', { name: 'Auto-deploy' });
		await expect(toggle).toHaveAttribute('aria-checked', 'false');
		await expect(toggle).toHaveAccessibleDescription(/berlangganan event push/);

		await toggle.click();
		await page.getByRole('button', { name: 'Simpan perubahan' }).click();

		await expect.poll(() => updates).toEqual([{ auto_deploy: true }]);
	});

	test('auto-deploy is off and explained for a public URL', async ({ page }) => {
		await mockProjectApi(page, {
			project: () => ({
				...baseProject,
				repository_source: 'public_url',
				github_installation_id: null,
				auto_deploy: true
			})
		});
		await page.goto(SETTINGS_URL);

		const toggle = page.getByRole('switch', { name: 'Auto-deploy' });
		await expect(toggle).toBeDisabled();
		await expect(toggle).toHaveAttribute('aria-checked', 'false');
		await expect(toggle).toHaveAccessibleDescription(/tidak tersedia untuk Public Git URL/);
	});
});

async function mockDashboard(page: Page, projects: unknown[], filters: string[] = []) {
	await mockWizardApi(page);
	await page.route('**/api/v1/app/projects?**', (route) => {
		const url = new URL(route.request().url());
		filters.push(url.searchParams.get('filter') ?? '');
		return route.fulfill({
			contentType: 'application/json',
			body: JSON.stringify({
				data: projects,
				links: { first: null, last: null, prev: null, next: null },
				meta: {
					current_page: 1,
					from: projects.length ? 1 : null,
					last_page: 1,
					links: [],
					path: null,
					per_page: 6,
					to: projects.length || null,
					total: projects.length
				}
			})
		});
	});
}

const listProject = {
	id: 'proj_1',
	name: 'Toko Kopi',
	repository_full_name: 'rani/toko-kopi',
	repository_source: 'github_installation',
	github_installation_id: '123',
	github_repository_id: 456,
	branch: 'main',
	thumbnail_url: null,
	runtime_status: 'running',
	stack: null,
	last_deployed_at: '2026-09-10T10:00:00Z',
	created_at: '2026-01-01T00:00:00Z'
};

test.describe('dashboard (U-59, U-54)', () => {
	test('an empty account gets the hero, and no filters to play with', async ({ page }) => {
		await mockDashboard(page, []);
		await page.goto('/projects');

		await expect(page.getByRole('heading', { name: 'Buat Proyek Baru' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Mulai Sekarang' })).toHaveAttribute(
			'href',
			/\/projects\/new$/
		);
		await expect(page.getByRole('button', { name: /hari terakhir/ })).toHaveCount(0);
	});

	test('an account with projects keeps the plain header', async ({ page }) => {
		await mockDashboard(page, [listProject]);
		await page.goto('/projects');

		await expect(
			page.getByRole('heading', { name: 'Toko Kopi' }).or(page.getByText('Toko Kopi'))
		).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Buat Proyek Baru' })).toHaveCount(0);
	});

	test('offers 90 days, and asks the API for it', async ({ page }) => {
		const filters: string[] = [];
		await mockDashboard(page, [listProject], filters);
		await page.goto('/projects');

		await page.getByRole('button', { name: '30 hari terakhir' }).click();
		await page.getByRole('option', { name: '90 hari terakhir' }).click();

		await expect.poll(() => filters).toContain('90_days');
		await expect(page.getByRole('button', { name: '90 hari terakhir' })).toBeVisible();
	});

	test('the header and the open filter stay inside the page at 320 px (U-96)', async ({ page }) => {
		await page.setViewportSize({ width: 320, height: 800 });
		await mockDashboard(page, [listProject]);
		await page.goto('/projects');

		await page.getByRole('button', { name: '30 hari terakhir' }).click();
		await expect(page.getByRole('option', { name: '90 hari terakhir' })).toBeVisible();

		const overflow = await page
			.locator('main')
			.first()
			.evaluate((main) => main.scrollWidth - main.clientWidth);
		expect(overflow).toBeLessThanOrEqual(0);
	});

	test('shows the framework only when the inspection named one', async ({ page }) => {
		await mockDashboard(page, [
			{
				...listProject,
				stack: { builder: 'railpack', provider: 'node', framework: 'vite', package_manager: 'pnpm' }
			},
			{
				...listProject,
				id: 'proj_2',
				name: 'Lain',
				stack: { builder: 'railpack', provider: 'node', framework: null, package_manager: null }
			}
		]);
		await page.goto('/projects');

		await expect(page.getByTestId('framework-chip')).toHaveCount(1);
		await expect(page.getByTestId('framework-chip')).toHaveText('vite');
	});

	test('a thumbnail that fails to load falls back to the placeholder', async ({ page }) => {
		await mockDashboard(page, [{ ...listProject, thumbnail_url: 'https://broken.invalid/x.png' }]);
		await page.route('https://broken.invalid/**', (route) => route.abort());
		await page.goto('/projects');

		await expect(page.getByTestId('thumbnail-placeholder')).toBeVisible();
		await expect(page.getByRole('img', { name: 'Toko Kopi' })).toHaveCount(0);
	});

	test('shows the pilot quota before it is used up', async ({ page }) => {
		await mockDashboard(page, [listProject]);
		await page.goto('/projects');

		await expect(page.getByText(/1 dari 3 proyek/)).toBeVisible();
	});

	test('warns on the dashboard when the quota is used up', async ({ page }) => {
		await mockWizardApi(page, {
			pilotLimits: () => ({
				body: {
					data: { ...pilotLimits, quotas: { ...pilotLimits.quotas, current_projects_count: 3 } }
				}
			})
		});
		await page.route('**/api/v1/app/projects?**', (route) =>
			route.fulfill({
				contentType: 'application/json',
				body: JSON.stringify({
					data: [listProject],
					links: { first: null, last: null, prev: null, next: null },
					meta: {
						current_page: 1,
						from: 1,
						last_page: 1,
						links: [],
						path: null,
						per_page: 6,
						to: 1,
						total: 1
					}
				})
			})
		);
		await page.goto('/projects');

		await expect(page.getByRole('alert').filter({ hasText: '3 dari 3' })).toBeVisible();
	});
});

test.describe('feedback (U-55, #14)', () => {
	const message = () => page_.getByLabel('Masukanmu');
	let page_: Page;

	test.beforeEach(({ page }) => {
		page_ = page;
	});

	test('nothing forces it: it opens from the menu, and the deploy page only links to it', async ({
		page
	}) => {
		await mockWizardApi(page, { project: () => baseProject });
		await page.goto('/projects');

		await page.getByRole('link', { name: 'Kirim Masukan' }).first().click();

		await expect(page).toHaveURL(/\/feedback$/);
		await expect(page.getByRole('heading', { name: 'Kirim masukan', exact: true })).toBeVisible();
		await expect(page.getByRole('dialog')).toHaveCount(0);
	});

	test('sends category, text and consent, then says what happens next', async ({ page }) => {
		const bodies: Record<string, unknown>[] = [];
		await mockWizardApi(page, {
			feedback: (body) => {
				bodies.push(body);
				return { status: 201, body: { data: { id: 'f-1', created_at: '2026-11-06T00:00:00Z' } } };
			}
		});
		await page.goto('/feedback');

		await page.getByLabel('Jenis masukan').selectOption('bug');
		await message().fill('Tombol deploy tidak merespons di ponsel.');
		await page.getByLabel(/boleh memakai masukan ini/).check();
		await page.getByRole('button', { name: 'Kirim masukan' }).click();

		const done = page.getByRole('heading', { name: 'Masukanmu sudah tersimpan' });
		await expect(done).toBeVisible();
		await expect(done).toBeFocused();
		await expect(page.getByText(/belum tentu mendapat balasan/)).toBeVisible();
		expect(bodies).toEqual([
			{
				category: 'bug',
				message: 'Tombol deploy tidak merespons di ponsel.',
				consent: true,
				project_id: null,
				deployment_id: null
			}
		]);
	});

	test('warns against pasting secrets, and consent is not ticked for the user', async ({
		page
	}) => {
		await mockWizardApi(page);
		await page.goto('/feedback');

		await expect(page.getByText(/Jangan menulis password, token/)).toBeVisible();
		await expect(page.getByLabel(/boleh memakai masukan ini/)).not.toBeChecked();
	});

	test('the context is visible and can be removed', async ({ page }) => {
		const bodies: Record<string, unknown>[] = [];
		await mockWizardApi(page, {
			project: () => baseProject,
			feedback: (body) => {
				bodies.push(body);
				return { status: 201, body: { data: { id: 'f-1', created_at: null } } };
			}
		});
		await page.goto(`/feedback?project=${PROJECT_ID}&deployment=${DEPLOYMENT_ID}`);

		await expect(page.getByText(`Proyek ${baseProject.name}`)).toBeVisible();
		await expect(page.getByText('Deployment #3')).toBeVisible();

		await page.getByRole('button', { name: 'Hapus kaitan dengan deployment' }).click();
		await expect(page.getByText(/^\s*Deployment/)).toHaveCount(0);

		await message().fill('Proyeknya lambat dibuka.');
		await page.getByRole('button', { name: 'Kirim masukan' }).click();

		await expect(page.getByRole('heading', { name: 'Masukanmu sudah tersimpan' })).toBeVisible();
		expect(bodies[0]).toMatchObject({ project_id: PROJECT_ID, deployment_id: null });
	});

	test('the deployment page offers it once the deployment is finished', async ({ page }) => {
		await mockProjectApi(page, {
			deployment: () => ({
				id: DEPLOYMENT_ID,
				project_id: PROJECT_ID,
				sequence: 3,
				branch: 'main',
				trigger: 'redeploy',
				status: 'succeeded',
				commit_sha: 'a3f2c9d',
				commit_message: 'feat',
				image_reference: null,
				requested_resources: null,
				effective_resources: null,
				applied_resources: null,
				finalization_deferred: false,
				finalization_deferred_reason: null,
				agent_node_id: null,
				is_active: true,
				cancel_requested_at: null,
				queue_state: null,
				started_at: '2026-09-20T08:41:02Z',
				finished_at: '2026-09-20T08:41:49Z',
				cancelled_at: null,
				failure_code: null,
				failure_summary: null,
				failure: null,
				created_at: '2026-09-20T08:41:00Z',
				updated_at: '2026-09-20T08:41:49Z'
			})
		});
		await page.goto(`/projects/${PROJECT_ID}/deployments/${DEPLOYMENT_ID}`);

		await expect(page.getByRole('link', { name: 'Kirim masukan', exact: true })).toHaveAttribute(
			'href',
			new RegExp(`/feedback\\?project=${PROJECT_ID}&deployment=${DEPLOYMENT_ID}$`)
		);
	});

	test('checks the bounds and says what is expected', async ({ page }) => {
		const bodies: unknown[] = [];
		await mockWizardApi(page, {
			feedback: (body) => {
				bodies.push(body);
				return { status: 201, body: { data: { id: 'f', created_at: null } } };
			}
		});
		await page.goto('/feedback');

		await page.getByRole('button', { name: 'Kirim masukan' }).click();
		await expect(message()).toHaveAccessibleDescription(/Tulis masukanmu dulu/);
		await expect(message()).toBeFocused();

		await message().fill('oke');
		await page.getByRole('button', { name: 'Kirim masukan' }).click();
		await expect(message()).toHaveAccessibleDescription(/minimal 5 karakter/);

		await message().fill('a'.repeat(2001));
		await page.getByRole('button', { name: 'Kirim masukan' }).click();
		await expect(message()).toHaveAccessibleDescription(/paling panjang 2000 karakter/);

		expect(bodies).toEqual([]);
	});

	test('keeps the text on a failure, and sending again works', async ({ page }) => {
		let attempts = 0;
		await mockWizardApi(page, {
			feedback: () => {
				attempts += 1;
				return attempts === 1
					? { status: 500, body: { message: 'Server Error' } }
					: { status: 201, body: { data: { id: 'f', created_at: null } } };
			}
		});
		await page.goto('/feedback');
		const text = 'Halaman detail lambat saat log panjang.';

		await message().fill(text);
		await page.getByRole('button', { name: 'Kirim masukan' }).click();

		await expect(page.getByRole('alert')).toBeVisible();
		await expect(message()).toHaveValue(text);

		await page.getByRole('button', { name: 'Kirim masukan' }).click();

		await expect(page.getByRole('heading', { name: 'Masukanmu sudah tersimpan' })).toBeVisible();
		expect(attempts).toBe(2);
	});

	test('a double click sends once, and the API duplicate refusal is shown', async ({ page }) => {
		let attempts = 0;
		await mockWizardApi(page, {
			feedback: () => {
				attempts += 1;
				return {
					status: 409,
					body: {
						message: 'Masukan yang sama sudah terkirim. Tunggu 5 menit sebelum mengirimnya lagi.'
					}
				};
			}
		});
		await page.goto('/feedback');

		await message().fill('Masukan yang sama persis.');
		await page.getByRole('button', { name: 'Kirim masukan' }).dblclick();

		await expect(page.getByRole('alert')).toHaveText(/Tunggu 5 menit/);
		expect(attempts).toBe(1);
		await expect(message()).toHaveValue('Masukan yang sama persis.');
	});

	test('works by keyboard, and fits 320 px', async ({ page }) => {
		await mockWizardApi(page);
		await page.setViewportSize({ width: 320, height: 700 });
		await page.goto('/feedback');

		await expect(page.getByRole('button', { name: 'Kirim masukan' })).toBeVisible();
		expect(
			await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
		).toBe(false);

		await message().focus();
		await page.keyboard.type('Dikirim dengan keyboard.');
		await page.keyboard.press('Tab');
		await page.keyboard.press('Space');
		await expect(page.getByLabel(/boleh memakai masukan ini/)).toBeChecked();
		await page.keyboard.press('Tab');
		await page.keyboard.press('Enter');

		await expect(page.getByRole('heading', { name: 'Masukanmu sudah tersimpan' })).toBeVisible();
	});
});

test.describe('rate limits', () => {
	const tooMany = {
		status: 429,
		headers: {
			'Content-Type': 'application/json',
			'Retry-After': '2',
			'Access-Control-Expose-Headers': 'Retry-After'
		},
		body: JSON.stringify({ message: 'Too Many Attempts.' })
	};

	test('loading during a 429 explains the wait, then recovers by itself', async ({ page }) => {
		await mockWizardApi(page);
		let refused = 0;
		await page.route('**/api/v1/auth/user', (route) => {
			if (refused === 0) {
				refused += 1;
				return route.fulfill(tooMany);
			}
			return route.fallback();
		});

		await page.goto('/feedback');

		await expect(page.getByText('Terlalu banyak permintaan')).toBeVisible();
		await expect(page.getByText(/mencoba lagi otomatis dalam \d+ detik/)).toBeVisible();
		await expect(page.getByText('Gagal memuat akunmu')).toHaveCount(0);

		await expect(page.getByRole('heading', { name: 'Kirim masukan', exact: true })).toBeVisible({
			timeout: 10_000
		});
		expect(refused).toBe(1);
	});

	test('during the wait it stays away from the API, instead of retrying', async ({ page }) => {
		await mockWizardApi(page);
		let userRequests = 0;
		await page.route('**/api/v1/auth/user', (route) => {
			userRequests += 1;
			return route.fulfill({ ...tooMany, headers: { ...tooMany.headers, 'Retry-After': '30' } });
		});

		await page.goto('/feedback');
		await expect(page.getByText('Terlalu banyak permintaan')).toBeVisible();
		await page.waitForTimeout(3_000);

		expect(userRequests).toBe(1);
	});
});

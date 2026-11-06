import { expect, test, type Page } from '@playwright/test';
import {
	createdProject,
	DEPLOYMENT_ID,
	INSTALLATIONS,
	mockWizardApi,
	pilotLimits,
	PROJECT_ID,
	repository,
	repositoryPage,
	succeededInspection
} from './fixtures/create-project';

const DEPLOYMENT_URL = new RegExp(`/projects/${PROJECT_ID}/deployments/${DEPLOYMENT_ID}$`);
const PROJECT_URL = new RegExp(`/projects/${PROJECT_ID}(/|$)`);

const buatProyek = (page: Page) => page.getByRole('button', { name: 'Buat proyek' });
const lanjut = (page: Page) => page.getByRole('button', { name: 'Lanjut', exact: true });

async function chooseFirstRepository(page: Page) {
	await page.goto('/projects/new');
	await page.getByRole('radio', { name: /rani\/repo-1\b/ }).click();
	await lanjut(page).click();
	await expect(page.getByRole('heading', { name: 'Persiapan deployment' })).toBeVisible();
}

async function pickBranch(page: Page, name: string) {
	await page.getByLabel('Branch', { exact: true }).click();
	await page.getByRole('option', { name, exact: true }).click();
}

async function addEnv(page: Page, key: string, value: string) {
	await page.getByLabel('Nama variabel').fill(key);
	await page.getByLabel('Nilai variabel').fill(value);
	await page.getByRole('button', { name: 'Tambah variabel' }).click();
	await expect(page.getByText(key, { exact: true })).toBeVisible();
}

test.describe('create project wizard, from GitHub', () => {
	test('walks the whole path to the deployment page', async ({ page }) => {
		let polls = 0;
		const calls = await mockWizardApi(page, {
			project: () => {
				polls += 1;
				return polls < 2
					? createdProject
					: {
							...createdProject,
							...succeededInspection,
							configured_port: 8080,
							effective_port: 8080
						};
			}
		});

		await page.goto('/projects/new');

		// Step 1: the count and the pages come from the API.
		await expect(page.getByRole('status').filter({ hasText: 'Menampilkan' })).toHaveText(
			/Menampilkan\s+5\s+dari\s+12\s+repository/
		);
		expect(calls.repositories[0].searchParams.get('per_page')).toBe('5');
		await page.getByRole('button', { name: 'Halaman 2', exact: true }).click();
		await expect(page.getByRole('radio', { name: /rani\/repo-6\b/ })).toBeVisible();
		await expect.poll(() => calls.repositories.at(-1)?.searchParams.get('page')).toBe('2');

		// Search goes to the API, once the typing stops.
		await page.getByPlaceholder('Cari repository...').fill('repo-1');
		await expect.poll(() => calls.repositories.at(-1)?.searchParams.get('search')).toBe('repo-1');
		expect(calls.repositories.at(-1)?.searchParams.get('page')).toBe('1');
		await expect(page.getByRole('status').filter({ hasText: 'Menampilkan' })).toHaveText(
			/Menampilkan\s+4\s+dari\s+4\s+repository/
		);

		await page.getByRole('radio', { name: /rani\/repo-1\b/ }).click();
		await lanjut(page).click();

		// Step 2: focus moves with the step, instead of falling to the body.
		const heading = page.getByRole('heading', { name: 'Persiapan deployment' });
		await expect(heading).toBeFocused();
		await expect(page.getByRole('listitem').filter({ hasText: 'Konfigurasi' })).toHaveAttribute(
			'aria-current',
			'step'
		);

		// The domain comes from the API, and it waits for the typing to stop.
		await expect(page.getByTestId('domain-preview')).toHaveText('repo-1-2.apps.example.test');
		await page.getByLabel('Nama proyek').press('End');
		await page.getByLabel('Nama proyek').pressSequentially('-baru');
		await expect(page.getByTestId('domain-preview')).toHaveText('repo-1-baru-2.apps.example.test');
		expect(calls.domainPreview).toEqual(['repo-1', 'repo-1-baru']);

		// The branch list is the real one.
		await page.getByLabel('Branch', { exact: true }).click();
		await expect(page.getByRole('option')).toHaveText(['main', 'develop', 'feat/checkout']);
		await page.getByRole('option', { name: 'develop', exact: true }).click();
		await expect(page.getByLabel('Branch', { exact: true })).toHaveValue('develop');

		await page.getByLabel('Port (opsional)').fill('8080');
		await page.getByLabel('Build command (opsional)').fill('pnpm build');
		await page.getByLabel('Start command (opsional)').fill('pnpm start');
		await page.getByLabel('Root directory (opsional)').fill('apps/web');
		await addEnv(page, 'APP_ENV', 'production');
		await page.getByRole('switch', { name: 'Auto-deploy' }).click();

		await buatProyek(page).click();

		// Step 3: the project exists now, and it says so by reading the API.
		await expect(page.getByRole('heading', { name: 'Sakala membaca proyekmu' })).toBeVisible();
		expect(calls.createProject).toEqual([
			{
				name: 'repo-1-baru',
				branch: 'develop',
				repository: {
					type: 'github_installation',
					installation_id: INSTALLATIONS[0].id,
					repository_id: 1001
				},
				configured_port: 8080,
				build_command: 'pnpm build',
				start_command: 'pnpm start',
				root_directory: 'apps/web',
				auto_deploy: true
			}
		]);
		expect(calls.addEnv).toEqual([{ key: 'APP_ENV', value: 'production', is_secret: true }]);
		await expect(page).toHaveURL(new RegExp(`project=${PROJECT_ID}`));
		await expect(page.getByTestId('project-domain')).toHaveText('repo-1.apps.example.test');

		// Real results: unknown stays unknown.
		await expect(page.getByText('Dockerfile terdeteksi')).toBeVisible({ timeout: 10_000 });
		await expect(page.getByRole('definition').filter({ hasText: 'pnpm' })).toBeVisible();
		await expect(page.getByText('Belum diketahui')).toBeVisible();
		await expect(page.getByText('8080 (kamu yang mengisi)')).toBeVisible();
		await expect(page.getByText(/punya \.env\.example/)).toBeVisible();

		await page.getByRole('button', { name: 'Deploy sekarang' }).click();

		await expect(page).toHaveURL(DEPLOYMENT_URL);
		expect(calls.deploy).toHaveLength(1);
		expect(calls.deploy[0].body).toEqual({ branch: 'develop' });
		expect(calls.deploy[0].headers['idempotency-key']).toBeTruthy();
	});

	test('switching installation reads that account, and forgets the old selection', async ({
		page
	}) => {
		const calls = await mockWizardApi(page, {
			repositories: (installationId, url) => ({
				body: repositoryPage(
					[repository(1, installationId === INSTALLATIONS[1].id ? 'kopi-org' : 'rani')],
					url
				)
			})
		});
		await page.goto('/projects/new');

		await page.getByRole('radio', { name: /rani\/repo-1\b/ }).click();
		await expect(lanjut(page)).toBeEnabled();

		await page.getByLabel('Akun GitHub').selectOption({ label: 'kopi-org' });

		await expect(page.getByRole('radio', { name: /kopi-org\/repo-1\b/ })).toBeVisible();
		expect(calls.repositories.at(-1)?.pathname).toContain(INSTALLATIONS[1].id);
		await expect(lanjut(page)).toBeDisabled();
	});

	test('a double click creates one project and one deployment', async ({ page }) => {
		const calls = await mockWizardApi(page, {
			project: () => ({ ...createdProject, ...succeededInspection })
		});
		await chooseFirstRepository(page);

		await buatProyek(page).dblclick();
		await expect(page.getByRole('heading', { name: 'Sakala membaca proyekmu' })).toBeVisible();
		expect(calls.createProject).toHaveLength(1);

		await page.getByRole('button', { name: 'Deploy sekarang' }).dblclick();
		await expect(page).toHaveURL(DEPLOYMENT_URL);
		expect(calls.deploy).toHaveLength(1);
	});

	test('a reload after creating does not bring the form back (no second project)', async ({
		page
	}) => {
		const calls = await mockWizardApi(page, {
			project: () => ({ ...createdProject, ...succeededInspection })
		});
		await chooseFirstRepository(page);
		await buatProyek(page).click();
		await expect(page.getByRole('heading', { name: 'Sakala membaca proyekmu' })).toBeVisible();

		await page.reload();

		await expect(page.getByRole('heading', { name: 'Sakala membaca proyekmu' })).toBeVisible();
		await expect(buatProyek(page)).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Keluar' })).toBeVisible();
		expect(calls.createProject).toHaveLength(1);
	});

	test('a 422 goes to the field it belongs to, and nothing is lost', async ({ page }) => {
		const calls = await mockWizardApi(page, {
			createProject: () => ({
				status: 422,
				body: {
					message: 'Data tidak valid',
					errors: { root_directory: ['Direktori root harus berupa path relatif.'] }
				}
			})
		});
		await chooseFirstRepository(page);
		await page.getByLabel('Root directory (opsional)').fill('apps/web');

		await buatProyek(page).click();

		const field = page.getByLabel('Root directory (opsional)');
		await expect(field).toHaveAccessibleDescription('Direktori root harus berupa path relatif.');
		await expect(field).toHaveValue('apps/web');
		await expect(field).toBeFocused();
		await expect(page.getByRole('heading', { name: 'Sakala membaca proyekmu' })).toHaveCount(0);
		expect(calls.createProject).toHaveLength(1);
	});

	test('fields are checked like the API does, before anything is sent', async ({ page }) => {
		const calls = await mockWizardApi(page);
		await chooseFirstRepository(page);

		await page.getByLabel('Port (opsional)').fill('70000');
		await page.getByLabel('Root directory (opsional)').fill('../rahasia');
		await page.getByLabel('Nama variabel').fill('9_SALAH');
		await page.getByLabel('Nilai variabel').fill('x');

		await buatProyek(page).click();

		await expect(page.getByLabel('Port (opsional)')).toHaveAccessibleDescription(/1 sampai 65535/);
		await expect(page.getByLabel('Root directory (opsional)')).toHaveAccessibleDescription(
			/\. atau \.\./
		);
		await expect(page.getByLabel('Nama variabel')).toHaveAccessibleDescription(/diawali huruf/);
		expect(calls.createProject).toHaveLength(0);
	});

	test('a variable typed but not added still goes with the project', async ({ page }) => {
		const calls = await mockWizardApi(page, {
			project: () => ({ ...createdProject, ...succeededInspection })
		});
		await chooseFirstRepository(page);

		await page.getByLabel('Nama variabel').fill('api_key');
		await page.getByLabel('Nilai variabel').fill('rahasia');
		await buatProyek(page).click();

		await expect(page.getByRole('heading', { name: 'Sakala membaca proyekmu' })).toBeVisible();
		expect(calls.addEnv).toEqual([{ key: 'API_KEY', value: 'rahasia', is_secret: true }]);
	});
});

test.describe('create project wizard, from a public URL', () => {
	test('walks the whole path to the deployment page', async ({ page }) => {
		const calls = await mockWizardApi(page, {
			installations: () => ({ body: { data: [] } }),
			createProject: (body) => ({
				status: 201,
				body: {
					data: {
						...createdProject,
						...body,
						repository_source: 'public_url',
						github_installation_id: null,
						github_repository_id: null
					}
				}
			}),
			project: () => ({
				...createdProject,
				...succeededInspection,
				name: 'situs',
				repository_source: 'public_url',
				repository_full_name: 'publik/situs',
				branch: 'gh-pages',
				inspection: {
					...succeededInspection.inspection,
					env_example_found: false,
					package_manager: null
				},
				stack: {
					builder: 'railpack',
					provider: 'node',
					framework: 'vite',
					package_manager: null
				}
			})
		});

		await page.goto('/projects/new');

		// Figma's not-connected frame: this link is a real control now.
		await expect(page.getByText('Belum ada akun GitHub yang terhubung')).toBeVisible();
		await page.getByRole('button', { name: 'Gunakan Public Git URL' }).click();

		await page.getByLabel('URL repository publik').fill('https://github.com/publik/situs');
		await lanjut(page).click();

		await expect(page.getByRole('heading', { name: 'Persiapan deployment' })).toBeVisible();
		await expect(page.getByLabel('Nama proyek')).toHaveValue('situs');
		await expect(page.getByLabel('Branch', { exact: true })).toHaveValue('trunk');

		// Real branches, from the endpoint for public repositories.
		await pickBranch(page, 'gh-pages');
		expect(calls.branches[0].searchParams.get('repository_url')).toBe(
			'https://github.com/publik/situs'
		);

		// Webhooks only exist for GitHub App installations.
		await expect(page.getByRole('switch', { name: 'Auto-deploy' })).toHaveCount(0);
		await expect(page.getByText(/Auto-deploy tidak tersedia untuk Public Git URL/)).toBeVisible();

		await buatProyek(page).click();
		await expect.poll(() => calls.createProject.length).toBe(1);
		expect(calls.createProject[0]).not.toHaveProperty('auto_deploy');

		await expect(page.getByRole('heading', { name: 'Sakala membaca proyekmu' })).toBeVisible();
		expect(calls.createProject).toEqual([
			{
				name: 'situs',
				branch: 'gh-pages',
				repository: { type: 'public_url', url: 'https://github.com/publik/situs' }
			}
		]);
		expect(calls.addEnv).toEqual([]);

		await expect(page.getByText('Build otomatis dengan Railpack')).toBeVisible();
		await expect(page.getByText('vite', { exact: true })).toBeVisible();
		await expect(page.getByText('Belum diketahui')).toBeVisible();

		await page.getByRole('button', { name: 'Deploy sekarang' }).click();

		await expect(page).toHaveURL(DEPLOYMENT_URL);
		expect(calls.deploy[0].body).toEqual({ branch: 'gh-pages' });
	});

	test('shows what the API said about a URL it refused, in place', async ({ page }) => {
		await mockWizardApi(page, {
			validate: () => ({
				status: 422,
				body: {
					message: 'Data tidak valid',
					errors: { repository_url: ['Repository tidak ditemukan atau bersifat privat.'] }
				}
			})
		});
		await page.goto('/projects/new');
		await page.getByRole('button', { name: 'Public Git URL' }).click();
		await page.getByLabel('URL repository publik').fill('https://github.com/publik/privat');

		await lanjut(page).click();

		await expect(page.getByText('Repository tidak ditemukan atau bersifat privat.')).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Persiapan deployment' })).toHaveCount(0);
	});
});

test.describe('partial env failure', () => {
	test('explains it, retries only what failed, and never recreates the project', async ({
		page
	}) => {
		let rejected = false;
		const calls = await mockWizardApi(page, {
			addEnv: (body) => {
				if (body.key === 'DATABASE_URL' && !rejected) {
					rejected = true;
					return {
						status: 422,
						body: {
							message: 'Nilai ditolak.',
							errors: { value: ['Nilai DATABASE_URL terlalu panjang.'] }
						}
					};
				}
				return { status: 201, body: { data: { id: 1, ...body } } };
			},
			envList: () => [{ id: 1, key: 'APP_ENV', is_secret: true }],
			project: () => ({ ...createdProject, ...succeededInspection })
		});
		await chooseFirstRepository(page);
		await addEnv(page, 'APP_ENV', 'production');
		await addEnv(page, 'DATABASE_URL', 'postgres://panjang');

		await buatProyek(page).click();

		const heading = page.getByRole('heading', { name: /Proyek sudah dibuat, tapi 1 variabel/ });
		await expect(heading).toBeVisible();
		await expect(heading).toBeFocused();
		await expect(page.getByText(/1 dari 2 variabel sudah tersimpan/)).toBeVisible();
		await expect(page.getByText('Nilai DATABASE_URL terlalu panjang.')).toBeVisible();
		// Saying "Batal" here would be a lie: nothing undoes the project.
		await expect(page.getByRole('button', { name: 'Keluar' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Batal', exact: true })).toHaveCount(0);

		await page.getByLabel('Nilai variabel').fill('postgres://pendek');
		await page.getByRole('button', { name: 'Simpan ulang variabel' }).click();

		await expect(page.getByRole('heading', { name: 'Sakala membaca proyekmu' })).toBeVisible();
		expect(calls.createProject).toHaveLength(1);
		expect(calls.addEnv.map((env) => [env.key, env.value])).toEqual([
			['APP_ENV', 'production'],
			['DATABASE_URL', 'postgres://panjang'],
			['DATABASE_URL', 'postgres://pendek']
		]);
	});

	test('a variable whose response got lost is not sent twice', async ({ page }) => {
		let attempts = 0;
		const calls = await mockWizardApi(page, {
			addEnv: () => {
				attempts += 1;
				return { status: 500, body: { message: 'Server Error' } };
			},
			// The API stored it: only the response never made it back.
			envList: () => [{ id: 9, key: 'APP_ENV', is_secret: true }],
			project: () => ({ ...createdProject, ...succeededInspection })
		});
		await chooseFirstRepository(page);
		await addEnv(page, 'APP_ENV', 'production');
		await buatProyek(page).click();
		await expect(page.getByRole('heading', { name: /tapi 1 variabel/ })).toBeVisible();

		await page.getByRole('button', { name: 'Simpan ulang variabel' }).click();

		await expect(page.getByRole('heading', { name: 'Sakala membaca proyekmu' })).toBeVisible();
		expect(attempts).toBe(1);
		expect(calls.createProject).toHaveLength(1);
	});

	test('can move on without the variable, and says the project stays', async ({ page }) => {
		await mockWizardApi(page, {
			addEnv: () => ({ status: 500, body: { message: 'Server Error' } }),
			envList: () => [],
			project: () => ({ ...createdProject, ...succeededInspection })
		});
		await chooseFirstRepository(page);
		await addEnv(page, 'APP_ENV', 'production');
		await buatProyek(page).click();

		await page.getByRole('button', { name: 'Lanjut tanpa variabel ini' }).click();

		await expect(page.getByRole('heading', { name: 'Sakala membaca proyekmu' })).toBeVisible();
	});
});

test.describe('auto detect', () => {
	test('while it runs, deploy waits and the page says it may be left', async ({ page }) => {
		await mockWizardApi(page, { project: () => createdProject });
		await page.goto(`/projects/new?project=${PROJECT_ID}`);

		await expect(page.getByText('Mendeteksi konfigurasi...').first()).toBeVisible();
		await expect(page.getByText(/boleh ditinggal/)).toBeVisible();
		// The first real inspection took 42 s, so slow must not read as failed.
		await expect(page.getByText(/satu menit atau lebih/)).toBeVisible();
		await expect(page.getByText(/gagal/i)).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Deploy sekarang' })).toBeDisabled();
		await expect(page.getByText(/beberapa detik lagi/i)).toHaveCount(0);
	});

	test('a failed inspection offers Deteksi ulang, which recovers', async ({ page }) => {
		let inspection = {
			preview_status: 'unavailable',
			inspection_error_code: 'github_unavailable'
		} as Record<string, unknown>;
		const calls = await mockWizardApi(page, {
			project: () => ({ ...createdProject, ...inspection }),
			inspect: () => {
				inspection = { ...succeededInspection, inspection_error_code: null };
				return { status: 202, body: { data: { ...createdProject, preview_status: 'pending' } } };
			}
		});
		await page.goto(`/projects/new?project=${PROJECT_ID}`);

		await expect(page.getByText(/gagal menghubungi GitHub/)).toBeVisible();
		await expect(page.getByText('Tidak terdeteksi').first()).toBeVisible();
		await expect(page.getByRole('button', { name: 'Deploy sekarang' })).toHaveCount(0);

		await page.getByRole('button', { name: 'Deteksi ulang' }).click();

		await expect(page.getByText('Dockerfile terdeteksi')).toBeVisible({ timeout: 10_000 });
		await expect(page.getByRole('button', { name: 'Deploy sekarang' })).toBeEnabled();
		await expect(page.getByRole('button', { name: 'Deteksi ulang' })).toHaveCount(0);
		expect(calls.inspect).toBe(1);
	});

	test('a refused Deteksi ulang says why, in Indonesian', async ({ page }) => {
		await mockWizardApi(page, {
			project: () => ({ ...createdProject, preview_status: 'failed' }),
			inspect: () => ({
				status: 429,
				headers: { 'Retry-After': '30', 'Access-Control-Expose-Headers': 'Retry-After' },
				body: { message: 'Too Many Attempts.' }
			})
		});
		await page.goto(`/projects/new?project=${PROJECT_ID}`);

		await page.getByRole('button', { name: 'Deteksi ulang' }).click();

		await expect(page.getByRole('alert').filter({ hasText: /30 detik/ })).toBeVisible();
		await expect(page.getByText('Too Many Attempts.')).toHaveCount(0);
	});

	test('names the missing branch when that is the reason', async ({ page }) => {
		await mockWizardApi(page, {
			project: () => ({
				...createdProject,
				preview_status: 'unavailable',
				inspection_error_code: 'branch_not_found'
			})
		});
		await page.goto(`/projects/new?project=${PROJECT_ID}`);

		await expect(page.getByText(/Branch develop tidak ditemukan/)).toBeVisible();
	});

	test('a refused deploy stays here and shows the reason', async ({ page }) => {
		await mockWizardApi(page, {
			project: () => ({ ...createdProject, ...succeededInspection }),
			deploy: () => ({
				status: 422,
				body: {
					code: 'ACTIVE_DEPLOYMENT_LIMIT_EXCEEDED',
					message: 'Batas deployment yang sedang berjalan tercapai.',
					errors: {}
				}
			})
		});
		await page.goto(`/projects/new?project=${PROJECT_ID}`);

		await page.getByRole('button', { name: 'Deploy sekarang' }).click();

		await expect(page.getByRole('alert')).toHaveText(
			'Batas deployment yang sedang berjalan tercapai.'
		);
		await expect(page).toHaveURL(/projects\/new/);
	});

	test('warns about the running-deployment limit before it is hit', async ({ page }) => {
		await mockWizardApi(page, {
			project: () => ({ ...createdProject, ...succeededInspection }),
			pilotLimits: () => ({
				body: {
					data: {
						...pilotLimits,
						quotas: { ...pilotLimits.quotas, current_active_deployments_count: 2 }
					}
				}
			})
		});
		await page.goto(`/projects/new?project=${PROJECT_ID}`);

		await expect(page.getByText(/2 deployment yang berjalan, dan batasnya 2/)).toBeVisible();
	});
});

test.describe('leaving the wizard', () => {
	test('Lewati says the project exists but is not deployed, then opens it', async ({ page }) => {
		const calls = await mockWizardApi(page, {
			project: () => ({ ...createdProject, ...succeededInspection })
		});
		await chooseFirstRepository(page);
		await buatProyek(page).click();
		await expect(page.getByRole('heading', { name: 'Sakala membaca proyekmu' })).toBeVisible();

		await page.getByRole('button', { name: 'Lewati' }).click();

		const dialog = page.getByRole('dialog');
		await expect(dialog).toContainText('sudah dibuat dan tetap tersimpan');
		await expect(dialog).toContainText('belum di-deploy');
		await expect(dialog).not.toContainText('akan tetap dibuat');

		await dialog.getByRole('button', { name: 'Ya, lewati' }).click();

		await expect(page).toHaveURL(PROJECT_URL);
		expect(calls.deploy).toHaveLength(0);
	});

	test('cancelling before the project exists creates nothing, and says so', async ({ page }) => {
		const calls = await mockWizardApi(page);
		await chooseFirstRepository(page);

		await page.getByRole('button', { name: 'Batal', exact: true }).click();

		const dialog = page.getByRole('dialog');
		await expect(dialog).toContainText('Proyek belum dibuat');
		await dialog.getByRole('button', { name: 'Ya, batalkan' }).click();

		await expect(page).toHaveURL(/\/projects$/);
		expect(calls.createProject).toHaveLength(0);
	});

	test('keeps going when the dialog is dismissed, with the form intact', async ({ page }) => {
		await mockWizardApi(page);
		await chooseFirstRepository(page);
		await page.getByLabel('Port (opsional)').fill('8080');

		await page.getByRole('button', { name: 'Batal', exact: true }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Lanjutkan proses' }).click();

		await expect(page.getByLabel('Port (opsional)')).toHaveValue('8080');
	});

	test('leaving after the project exists does not pretend to undo it', async ({ page }) => {
		const calls = await mockWizardApi(page, {
			project: () => ({ ...createdProject, ...succeededInspection })
		});
		await chooseFirstRepository(page);
		await buatProyek(page).click();
		await expect(page.getByRole('heading', { name: 'Sakala membaca proyekmu' })).toBeVisible();

		await page.getByRole('button', { name: 'Keluar' }).click();

		const dialog = page.getByRole('dialog');
		await expect(dialog).toContainText('Keluar tidak menghapusnya');
		await expect(dialog).not.toContainText('belum akan dibuat');
		await dialog.getByRole('button', { name: 'Ya, keluar' }).click();

		await expect(page).toHaveURL(PROJECT_URL);
		expect(calls.createProject).toHaveLength(1);
	});
});

test.describe('repository step states', () => {
	test('a 409 installation offers a real reconnect', async ({ page }) => {
		await mockWizardApi(page, {
			repositories: () => ({
				status: 409,
				body: {
					message: 'GitHub installation is no longer active. Reconnect GitHub and try again.'
				}
			})
		});
		await page.goto('/projects/new');

		const link = page.getByRole('link', { name: 'Hubungkan ulang GitHub' });
		await expect(link).toHaveAttribute(
			'href',
			new RegExp(`/auth/github/installations/${INSTALLATIONS[0].id}/configure$`)
		);
		await expect(page.getByText(/rani sudah tidak aktif/)).toBeVisible();
		await expect(page.getByText(/no longer active/)).toHaveCount(0);
	});

	test('a removed installation reconnects through a new install', async ({ page }) => {
		await mockWizardApi(page, {
			installations: () => ({
				body: { data: [{ ...INSTALLATIONS[0], status: 'removed' }] }
			}),
			repositories: () => ({ status: 409, body: { message: 'no longer active' } })
		});
		await page.goto('/projects/new');

		await expect(page.getByRole('link', { name: 'Hubungkan ulang GitHub' })).toHaveAttribute(
			'href',
			/\/auth\/github\/install$/
		);
	});

	test('zero repositories offers the configure link (audit notes)', async ({ page }) => {
		await mockWizardApi(page, {
			installations: () => ({ body: { data: [INSTALLATIONS[0]] } }),
			repositories: (_id, url) => ({ body: repositoryPage([], url) })
		});
		await page.goto('/projects/new');

		await expect(page.getByText('Belum ada repository yang bisa dipilih')).toBeVisible();
		await expect(page.getByRole('link', { name: 'Atur akses repository' })).toHaveAttribute(
			'href',
			new RegExp(`/auth/github/installations/${INSTALLATIONS[0].id}/configure$`)
		);
		await expect(page.getByLabel('Akun GitHub')).toHaveCount(0);
	});

	test('no search hits is not called an empty account (audit notes)', async ({ page }) => {
		await mockWizardApi(page);
		await page.goto('/projects/new');
		await expect(page.getByRole('radio').first()).toBeVisible();

		await page.getByPlaceholder('Cari repository...').fill('tidak-ada-yang-cocok');

		await expect(page.getByText('Tidak ada repository yang cocok')).toBeVisible();
		await expect(page.getByText('Belum ada repository yang bisa dipilih')).toHaveCount(0);

		await page.getByRole('button', { name: 'Hapus pencarian' }).click();

		await expect(page.getByRole('radio').first()).toBeVisible();
	});
});

test.describe('pilot limits', () => {
	const quotaFull = () => ({
		body: {
			data: { ...pilotLimits, quotas: { ...pilotLimits.quotas, current_projects_count: 3 } }
		}
	});

	test('shows the quota before it is used up', async ({ page }) => {
		await mockWizardApi(page);
		await page.goto('/projects/new');

		await expect(page.getByText(/1 dari 3 proyek/)).toBeVisible();
	});

	test('at the limit, says so first and does not let the form be filled in vain', async ({
		page
	}) => {
		const calls = await mockWizardApi(page, { pilotLimits: quotaFull });
		await page.goto('/projects/new');

		await expect(page.getByRole('alert').filter({ hasText: '3 dari 3' })).toBeVisible();
		await page.getByRole('radio', { name: /rani\/repo-1\b/ }).click();
		await expect(lanjut(page)).toBeDisabled();
		expect(calls.createProject).toHaveLength(0);
	});

	test('shows the runtime limits on the configuration step', async ({ page }) => {
		await mockWizardApi(page);
		await chooseFirstRepository(page);

		await expect(page.getByText(/memori 256 MB dan CPU 0,5 vCPU/)).toBeVisible();
	});

	test('a refusal the page did not foresee comes through in Indonesian', async ({ page }) => {
		await mockWizardApi(page, {
			createProject: () => ({
				status: 422,
				body: {
					code: 'PROJECT_LIMIT_EXCEEDED',
					message: 'Kuota project selama pilot sudah habis.',
					errors: {},
					limit: 3,
					current: 3
				}
			})
		});
		await chooseFirstRepository(page);

		await buatProyek(page).click();

		await expect(page.getByRole('alert')).toContainText('Kuota project selama pilot sudah habis.');
	});
});

test.describe('branches when the list is not simple', () => {
	test('a failed list keeps the default branch and offers a retry', async ({ page }) => {
		let attempts = 0;
		await mockWizardApi(page, {
			branches: () => {
				attempts += 1;
				// A 5xx gets one automatic retry, so the second answer has to fail as well.
				return attempts <= 2
					? { status: 502, body: { message: 'Bad Gateway' } }
					: { body: { data: [{ name: 'main' }, { name: 'hotfix' }] } };
			}
		});
		await chooseFirstRepository(page);

		await expect(page.getByLabel('Branch', { exact: true })).toHaveValue('main');
		const alert = page.getByRole('alert').filter({ hasText: 'branch default repository, main' });
		await expect(alert).toBeVisible({ timeout: 10_000 });

		await alert.getByRole('button', { name: 'Coba lagi' }).click();

		await pickBranch(page, 'hotfix');
		await expect(page.getByLabel('Branch', { exact: true })).toHaveValue('hotfix');
	});

	test('the API cut the list at 100, so a name outside it can still be typed', async ({ page }) => {
		const calls = await mockWizardApi(page, {
			branches: () => ({
				body: { data: Array.from({ length: 100 }, (_, i) => ({ name: `b-${i}` })) }
			}),
			project: () => ({ ...createdProject, ...succeededInspection })
		});
		await chooseFirstRepository(page);

		await expect(page.getByText(/100 branch pertama/)).toBeVisible();
		await expect(page.getByLabel('Branch', { exact: true })).toHaveValue('main');

		await page.getByLabel('Branch', { exact: true }).fill('branch-ke-101');
		await page.getByRole('option', { name: 'Pakai branch "branch-ke-101"' }).click();
		await buatProyek(page).click();

		await expect(page.getByRole('heading', { name: 'Sakala membaca proyekmu' })).toBeVisible();
		expect(calls.createProject[0].branch).toBe('branch-ke-101');
	});
});

test.describe('narrow screens', () => {
	for (const width of [320, 1280]) {
		test(`every step stays inside the page at ${width} px`, async ({ page }) => {
			await page.setViewportSize({ width, height: 800 });
			await mockWizardApi(page, {
				project: () => ({ ...createdProject, ...succeededInspection })
			});
			const overflows = () =>
				page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

			await page.goto('/projects/new');
			await expect(page.getByRole('radio').first()).toBeVisible();
			expect(await overflows()).toBe(false);

			await page.getByRole('radio').first().click();
			await lanjut(page).click();
			await expect(page.getByRole('heading', { name: 'Persiapan deployment' })).toBeVisible();
			await addEnv(page, 'DATABASE_URL_YANG_PANJANG_SEKALI', 'nilai');
			expect(await overflows()).toBe(false);

			await buatProyek(page).click();
			await expect(page.getByRole('heading', { name: 'Sakala membaca proyekmu' })).toBeVisible();
			await expect(page.getByRole('button', { name: 'Deploy sekarang' })).toBeVisible();
			expect(await overflows()).toBe(false);
		});
	}
});

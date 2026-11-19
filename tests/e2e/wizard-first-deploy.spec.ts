import { expect, test, type Page } from '@playwright/test';
import {
	createdProject,
	DEPLOYMENT_ID,
	mockWizardApi,
	PROJECT_ID,
	repository,
	succeededInspection
} from './fixtures/create-project';
import { mockEveryRoute } from './fixtures/all-routes';
import {
	baseProject,
	DETAIL_URL,
	mockProjectApi,
	succeededDeployment
} from './fixtures/project-detail';

const DEPLOYMENT_URL = new RegExp(`/projects/${PROJECT_ID}/deployments/${DEPLOYMENT_ID}$`);
const PROJECT_URL = new RegExp(`/projects/${PROJECT_ID}(/|$)`);
const EXAMPLES_REPOSITORY = 'https://github.com/gmedia/sakala-examples';

const TEN_LINES = `# from my laptop
APP_NAME="Toko Kopi"
APP_ENV=production

APP_DEBUG=false
APP_URL=https://toko-kopi.sakala.app
DB_HOST=db.local
DB_PORT=5432
DB_DATABASE=kopi
DB_USERNAME=kopi
DB_PASSWORD=rahasia
MAIL_MAILER=log
`;

async function toConfiguration(page: Page) {
	await page.goto('/projects/new');
	await page.getByRole('radio', { name: /rani\/repo-1\b/ }).click();
	await page.getByRole('button', { name: 'Lanjut', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Persiapan deployment' })).toBeVisible();
}

async function addDraft(page: Page, key: string, value: string) {
	await page.getByLabel('Nama variabel').fill(key);
	await page.getByLabel('Nilai variabel').fill(value);
	await page.getByRole('button', { name: 'Tambah variabel' }).click();
}

/** What a paste from the clipboard does, without needing clipboard permission. */
async function pasteInto(page: Page, label: string, text: string) {
	await page.getByLabel(label).evaluate((element, value) => {
		const data = new DataTransfer();
		data.setData('text', value);
		element.dispatchEvent(
			new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true })
		);
	}, text);
}

test.describe('the first deploy does not wait for detection when it does not need it', () => {
	test('commands say they are detected, instead of showing example values', async ({ page }) => {
		await mockWizardApi(page);
		await toConfiguration(page);
		await page.getByRole('button', { name: 'Pengaturan lanjutan' }).click();

		for (const label of [
			'Port (opsional)',
			'Build command (opsional)',
			'Start command (opsional)'
		]) {
			await expect(page.getByLabel(label)).toHaveAttribute('placeholder', 'Dideteksi otomatis');
		}
		await expect(page.getByLabel('Release command (opsional)')).toHaveAttribute(
			'placeholder',
			'Tidak ada'
		);
		await expect(page.getByPlaceholder('php artisan migrate --force')).toHaveCount(0);
	});

	test('the deploy button is not held by detection once the port is configured', async ({
		page
	}) => {
		const calls = await mockWizardApi(page, {
			// The API answers with the configured port while inspection stays pending throughout.
			project: () => ({ ...createdProject, configured_port: 5000, effective_port: 5000 })
		});
		await toConfiguration(page);
		await page.getByRole('button', { name: 'Pengaturan lanjutan' }).click();
		await page.getByLabel('Port (opsional)').fill('5000');

		const started = Date.now();
		await page.getByRole('button', { name: 'Buat dan deploy' }).click();
		await expect(page).toHaveURL(DEPLOYMENT_URL);

		expect(calls.deploy).toHaveLength(1);
		// Well under the 5 s inspection poll: nothing waited for detection.
		expect(Date.now() - started).toBeLessThan(4_000);
	});

	test('without a port it waits for detection, then deploys with no further click', async ({
		page
	}) => {
		let gets = 0;
		const calls = await mockWizardApi(page, {
			project: () => {
				gets += 1;
				return gets < 2 ? createdProject : { ...createdProject, ...succeededInspection };
			}
		});
		await toConfiguration(page);

		await page.getByRole('button', { name: 'Buat dan deploy' }).click();

		await expect(page.getByRole('heading', { name: 'Deploy pertama' })).toBeVisible();
		await expect(page.getByText(/Deploy dimulai otomatis setelah itu/)).toBeVisible();
		expect(calls.deploy).toHaveLength(0);
		await expect(page).toHaveURL(DEPLOYMENT_URL, { timeout: 15_000 });
		expect(calls.deploy).toHaveLength(1);
	});
});

test.describe('a GitHub URL is accepted as typed', () => {
	for (const typed of [
		'github.com/publik/situs',
		'https://github.com/publik/situs/',
		'https://github.com/publik/situs/tree/main/src',
		'https://github.com/publik/situs.git',
		'publik/situs'
	]) {
		test(`"${typed}" is sent as https://github.com/publik/situs`, async ({ page }) => {
			const validated: unknown[] = [];
			const calls = await mockWizardApi(page, {
				validate: (body) => {
					validated.push(body.repository_url);
					return {
						body: {
							data: {
								...repository(7, 'publik'),
								name: 'situs',
								full_name: 'publik/situs',
								clone_url: 'https://github.com/publik/situs.git',
								default_branch: 'main'
							}
						}
					};
				}
			});
			await page.goto('/projects/new');
			await page.getByRole('button', { name: 'URL GitHub publik', exact: true }).click();
			await page.getByLabel('URL repository GitHub publik').fill(typed);
			await page.getByRole('button', { name: 'Lanjut', exact: true }).click();

			await expect(page.getByRole('heading', { name: 'Persiapan deployment' })).toBeVisible();
			await page.getByRole('button', { name: 'Buat tanpa deploy' }).click();
			await expect.poll(() => calls.createProject.length).toBe(1);

			expect(validated).toEqual(['https://github.com/publik/situs']);
			expect(calls.createProject[0].repository).toEqual({
				type: 'public_url',
				url: 'https://github.com/publik/situs'
			});
		});
	}

	test('another host is refused with an example of what works', async ({ page }) => {
		await mockWizardApi(page);
		await page.goto('/projects/new');
		await page.getByRole('button', { name: 'URL GitHub publik', exact: true }).click();
		const field = page.getByLabel('URL repository GitHub publik');
		await field.fill('https://gitlab.com/publik/situs');
		await field.blur();

		await expect(field).toHaveAccessibleDescription(
			/baru bisa membaca repository dari GitHub.*https:\/\/github\.com\/owner\/repo/
		);
		await expect(page.getByRole('button', { name: 'Lanjut', exact: true })).toBeDisabled();
	});
});

test.describe('a whole .env can be pasted', () => {
	test('10 lines with 2 existing keys: 8 new, the 2 kept unless Timpa is chosen', async ({
		page
	}) => {
		const calls = await mockWizardApi(page);
		await toConfiguration(page);
		await addDraft(page, 'APP_ENV', 'staging');
		await addDraft(page, 'DB_HOST', 'localhost');

		await page.getByRole('button', { name: 'Tempel dari .env' }).click();
		await page.getByRole('textbox', { name: 'Isi file .env' }).fill(TEN_LINES);

		await expect(page.getByTestId('env-import').getByRole('status')).toHaveText(
			'10 variabel terbaca: 8 baru, 2 sudah ada.'
		);
		await expect(page.getByLabel('Lewati, pertahankan nilai yang sekarang')).toBeChecked();
		await page.getByRole('button', { name: 'Tambahkan 8 variabel' }).click();
		await expect(page.getByText('8 variabel ditambahkan ke daftar.')).toBeVisible();

		await page.getByRole('button', { name: 'Buat tanpa deploy' }).click();
		await expect(page).toHaveURL(PROJECT_URL);

		expect(calls.addEnv).toHaveLength(10);
		expect(calls.addEnv.find((env) => env.key === 'APP_ENV')?.value).toBe('staging');
		expect(calls.addEnv.find((env) => env.key === 'DB_HOST')?.value).toBe('localhost');
		expect(calls.addEnv.every((env) => env.is_secret === true)).toBe(true);
	});

	test('pasting into the name field opens the preview, and PORT becomes the project port', async ({
		page
	}) => {
		const calls = await mockWizardApi(page);
		await toConfiguration(page);

		await pasteInto(page, 'Nama variabel', 'PORT=5000\nAPP_ENV=production\n');

		await expect(page.getByTestId('env-import')).toContainText('Port proyek diisi 5000');
		await page.getByRole('button', { name: 'Tambahkan 1 variabel' }).click();
		await page.getByRole('button', { name: 'Buat tanpa deploy' }).click();
		await expect.poll(() => calls.createProject.length).toBe(1);

		expect(calls.createProject[0].configured_port).toBe(5000);
		await expect.poll(() => calls.addEnv.map((env) => env.key)).toEqual(['APP_ENV']);
	});

	test('on the Variabel tab, Timpa updates the saved key and adds the rest', async ({ page }) => {
		const added: Record<string, unknown>[] = [];
		const updated: Record<string, unknown>[] = [];
		await mockProjectApi(page, {
			envList: () => [
				{ id: 7, key: 'APP_ENV', is_secret: true, created_at: '2026-01-01T00:00:00Z' }
			],
			addEnv: (body) => {
				added.push(body);
				return { status: 201, body: { data: { id: 8, ...body } } };
			},
			updateEnv: (body) => {
				updated.push(body);
				return { body: { data: { id: 7, key: 'APP_ENV', is_secret: true } } };
			}
		});
		await page.goto(`/projects/${PROJECT_ID}/environments`);

		await page.getByRole('button', { name: 'Tempel dari .env' }).click();
		await page
			.getByRole('textbox', { name: 'Isi file .env' })
			.fill('APP_ENV=production\nAPP_DEBUG=false');
		await page.getByLabel('Timpa dengan nilai yang ditempel').check();
		await page.getByRole('button', { name: 'Simpan 2 variabel' }).click();

		await expect(page.getByText(/2 variabel disimpan/)).toBeVisible();
		expect(added).toEqual([{ key: 'APP_DEBUG', value: 'false', is_secret: true }]);
		expect(updated).toEqual([{ value: 'production', is_secret: true }]);
	});
});

test.describe('starting from an example repository', () => {
	test('a link with ?example= fills the wizard and opens the configuration', async ({ page }) => {
		const validated: unknown[] = [];
		const calls = await mockWizardApi(page, {
			installations: () => ({ body: { data: [] } }),
			validate: (body) => {
				validated.push(body.repository_url);
				return {
					body: {
						data: {
							...repository(9, 'gmedia'),
							name: 'sakala-examples',
							full_name: 'gmedia/sakala-examples',
							clone_url: `${EXAMPLES_REPOSITORY}.git`,
							default_branch: 'main'
						}
					}
				};
			}
		});

		await page.goto('/projects/new?example=laravel');

		await expect(page.getByRole('heading', { name: 'Persiapan deployment' })).toBeVisible();
		await expect(page.getByTestId('starter-example-notice')).toContainText('Laravel');
		await expect(page.getByTestId('starter-example-notice')).toContainText('APP_KEY');
		await expect(page.getByLabel('Nama proyek')).toHaveValue('contoh-laravel');
		await expect(page.getByLabel('Root directory (opsional)')).toHaveValue('laravel');

		await page.getByRole('button', { name: 'Buat tanpa deploy' }).click();
		await expect.poll(() => calls.createProject.length).toBe(1);

		await expect.poll(() => calls.addEnv.length).toBe(1);
		expect(validated).toEqual([EXAMPLES_REPOSITORY]);
		expect(calls.createProject[0]).toMatchObject({
			name: 'contoh-laravel',
			repository: { type: 'public_url', url: EXAMPLES_REPOSITORY },
			root_directory: 'laravel'
		});
		expect(calls.addEnv).toHaveLength(1);
		expect(calls.addEnv[0]).toMatchObject({ key: 'APP_KEY', is_secret: true });
		expect(String(calls.addEnv[0].value)).toMatch(/^base64:[A-Za-z0-9+/]{43}=$/);
	});

	test('the empty project list links each example', async ({ page }) => {
		await mockEveryRoute(page);
		await page.route(/\/api\/v1\/app\/projects(\?.*)?$/, (route) =>
			route.request().method() === 'GET'
				? route.fulfill({
						contentType: 'application/json',
						body: JSON.stringify({
							data: [],
							links: { first: null, last: null, prev: null, next: null },
							meta: {
								current_page: 1,
								from: null,
								last_page: 1,
								links: [],
								path: null,
								per_page: 6,
								to: null,
								total: 0
							}
						})
					})
				: route.fallback()
		);
		await page.goto('/projects');

		await expect(page.getByRole('link', { name: 'Situs HTML statis' })).toHaveAttribute(
			'href',
			'/projects/new?example=static-site'
		);
		await expect(page.getByRole('link', { name: 'Buat proyek' })).toHaveCount(1);
	});
});

test.describe('sharing the address once it is live', () => {
	const first = { ...succeededDeployment, sequence: 1 };

	test('Kode QR opens a code for the live address', async ({ page }) => {
		await mockProjectApi(page, { deployment: () => first, deploymentList: () => [first] });
		await page.goto(DETAIL_URL);

		await page.getByTestId('first-live').getByRole('button', { name: 'Kode QR' }).click();

		const dialog = page.getByRole('dialog', { name: 'Buka dari HP' });
		await expect(dialog.getByTestId('site-qr')).toBeVisible();
		await expect(dialog.getByRole('img', { name: /Kode QR untuk/ })).toBeVisible();
		await expect(dialog).toContainText(new URL(baseProject.public_url).host);
	});

	test('Bagikan appears only where the browser has a share sheet, and passes the URL', async ({
		page
	}) => {
		await page.addInitScript(() => {
			Object.defineProperty(navigator, 'share', {
				configurable: true,
				value: (data: ShareData) => {
					(window as unknown as { shared: ShareData }).shared = data;
					return Promise.resolve();
				}
			});
		});
		await mockProjectApi(page, { deployment: () => first, deploymentList: () => [first] });
		await page.goto(DETAIL_URL);

		await page.getByTestId('first-live').getByRole('button', { name: 'Bagikan' }).click();

		await expect
			.poll(() => page.evaluate(() => (window as unknown as { shared?: ShareData }).shared))
			.toEqual({ title: baseProject.name, url: baseProject.public_url });
	});

	test('without a share sheet there is no Bagikan; Salin stays', async ({ page }) => {
		await page.addInitScript(() => {
			Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
		});
		await mockProjectApi(page, { deployment: () => first, deploymentList: () => [first] });
		await page.goto(DETAIL_URL);

		await expect(
			page.getByTestId('first-live').getByRole('button', { name: 'Kode QR' })
		).toBeVisible();
		await expect(page.getByRole('button', { name: 'Bagikan' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Salin URL' })).toBeVisible();
	});
});

test.describe('keyboard', () => {
	test.use({ viewport: { width: 1440, height: 900 } });

	test('the whole public URL path works by keyboard, and the sticky footer never covers focus', async ({
		page
	}) => {
		const calls = await mockWizardApi(page, {
			project: () => ({ ...createdProject, configured_port: 8080, effective_port: 8080 })
		});
		await page.goto('/projects/new');
		await page.getByRole('button', { name: 'URL GitHub publik', exact: true }).focus();
		await page.keyboard.press('Enter');
		await page.keyboard.press('Tab');
		await expect(page.getByLabel('URL repository GitHub publik')).toBeFocused();
		await page.keyboard.type('github.com/publik/situs/');

		// Tab on until Lanjut, then Enter.
		for (let i = 0; i < 12; i++) {
			await page.keyboard.press('Tab');
			if (
				await page
					.getByRole('button', { name: 'Lanjut', exact: true })
					.evaluate((el) => el === document.activeElement)
			)
				break;
		}
		await page.keyboard.press('Enter');
		await expect(page.getByRole('heading', { name: 'Persiapan deployment' })).toBeFocused();

		// Every stop on the way down stays above the sticky footer.
		const footer = page.getByTestId('wizard-step-footer');
		for (let i = 0; i < 40; i++) {
			await page.keyboard.press('Tab');
			const focused = await page.evaluate(() => {
				const el = document.activeElement as HTMLElement;
				const box = el.getBoundingClientRect();
				return {
					text: el.textContent?.trim() ?? '',
					bottom: box.bottom,
					inFooter: !!el.closest('[data-sticky-step-footer]')
				};
			});
			if (!focused.inFooter) {
				const footerTop = (await footer.boundingBox())!.y;
				expect(focused.bottom, `focus on "${focused.text}"`).toBeLessThanOrEqual(footerTop + 1);
			}
			if (focused.text === 'Buat dan deploy') break;
		}
		await page.keyboard.press('Enter');

		await expect(page).toHaveURL(DEPLOYMENT_URL);
		expect(calls.createProject).toHaveLength(1);
	});

	test('the .env panel opens with focus in the text area, and Esc gives focus back', async ({
		page
	}) => {
		await mockWizardApi(page);
		await toConfiguration(page);

		await page.getByRole('button', { name: 'Tempel dari .env' }).focus();
		await page.keyboard.press('Enter');
		await expect(page.getByRole('textbox', { name: 'Isi file .env' })).toBeFocused();
		await page.keyboard.press('Escape');

		await expect(page.getByTestId('env-import')).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Tempel dari .env' })).toBeFocused();
	});
});

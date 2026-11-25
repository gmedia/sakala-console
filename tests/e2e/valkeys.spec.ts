import { mkdir } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { auditDom } from './fixtures/dom-audit';
import { PROJECT_ID } from './fixtures/project-detail';
import {
	PASSWORD_ROTATION_DEPLOYMENT_ID,
	QUEUE_ID,
	attachedProject,
	cacheValkey,
	capturedValkey,
	lockedValkey,
	mockValkeyApi,
	provisioningValkey,
	queueValkey,
	unknownRotationValkey
} from './fixtures/valkeys';

const LIST_URL = '/valkeys';
const NEW_URL = '/valkeys/new';
const ENV_URL = `/projects/${PROJECT_ID}/environments`;
const detailUrl = (id = QUEUE_ID) => `/valkeys/${id}`;

async function settled(page: Page) {
	await page.waitForLoadState('networkidle');
	await expect(page.locator('main')).toHaveCount(1);
}

const sidebarValkey = (page: Page) =>
	page.getByRole('link', { name: 'Valkey', exact: true }).first();

const laravelStack = {
	builder: 'railpack',
	provider: 'php',
	framework: 'laravel',
	package_manager: 'composer'
};

test.describe('where Valkey appears', () => {
	test('a workspace opened for Valkey gets the Valkey menu', async ({ page }) => {
		await mockValkeyApi(page);
		await page.goto(LIST_URL);
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Valkey');
		await expect(sidebarValkey(page)).toHaveAttribute('aria-current', 'page');
	});

	test('with the server flag off nothing new shows and no Valkey endpoint is asked', async ({
		page
	}) => {
		const { calls } = await mockValkeyApi(page, { enabled: false });
		await page.goto(ENV_URL);
		await settled(page);
		await expect(sidebarValkey(page)).toHaveCount(0);
		await expect(page.getByTestId('valkey-variables')).toHaveCount(0);
		await expect(page.getByTestId('valkey-variables-offer')).toHaveCount(0);

		// A link typed by hand says Valkey is not available, from pilot-limits alone.
		await page.goto(LIST_URL);
		await expect(page.getByRole('heading', { name: 'Valkey belum tersedia' })).toBeVisible();
		await page.goto(NEW_URL);
		await expect(page.getByRole('heading', { name: 'Valkey belum tersedia' })).toBeVisible();
		await expect(page.getByTestId('create-valkey-form')).toHaveCount(0);
		expect(calls).toEqual([]);
	});

	test('a workspace with no Valkey quota sees no menu, and a quiet note on the page', async ({
		page
	}) => {
		await mockValkeyApi(page, { valkeys: [], quota: { max_valkeys: 0, max_valkey_memory_mb: 0 } });
		await page.goto(LIST_URL);
		await expect(page.getByTestId('valkeys-closed')).toContainText(
			'Workspace ini belum bisa membuat Valkey'
		);
		await expect(page.getByTestId('create-valkey')).toHaveCount(0);
		await expect(sidebarValkey(page)).toHaveCount(0);
	});

	test('an installation without a Valkey node says so, with no way to create one', async ({
		page
	}) => {
		await mockValkeyApi(page, { valkeys: [], available: false });
		await page.goto(LIST_URL);
		await expect(
			page.getByRole('heading', { name: 'Valkey belum bisa dibuat di server ini' })
		).toBeVisible();
		await expect(page.getByTestId('create-valkey')).toHaveCount(0);
	});
});

test.describe('Valkey list', () => {
	test('lists each store with mode, memory against its size, status, projects, and the quota', async ({
		page
	}) => {
		await mockValkeyApi(page, {
			valkeys: [provisioningValkey(), cacheValkey(), queueValkey(), lockedValkey()],
			quota: { max_valkeys: 5, max_valkey_memory_mb: 512 }
		});
		await page.goto(LIST_URL);
		const rows = page.getByTestId('valkey-row');
		await expect(rows).toHaveCount(4);
		await expect(rows.nth(0)).toContainText('Menyiapkan');
		await expect(rows.nth(1)).toContainText('Cache');
		await expect(rows.nth(1)).toContainText('27 MB dari 32 MB');
		await expect(rows.nth(1)).toContainText('hampir penuh');
		await expect(rows.nth(2)).toContainText('Persisten');
		await expect(rows.nth(2)).toContainText('18 MB dari 64 MB');
		await expect(rows.nth(2)).toContainText(attachedProject.name);
		await expect(rows.nth(3)).toContainText('Dikunci');
		await expect(rows.nth(3)).toContainText('aplikasi tidak bisa login');
		await expect(page.getByTestId('valkey-quota-count')).toHaveText('4 dari 5 Valkey');
		await expect(page.getByTestId('valkey-quota-memory')).toContainText(
			'dicadangkan 224 MB dari 512 MB'
		);
	});

	test('an empty workspace explains Valkey in Redis terms and offers to create one', async ({
		page
	}) => {
		await mockValkeyApi(page, { valkeys: [] });
		await page.goto(LIST_URL);
		await expect(page.getByText('kompatibel dengan Redis').first()).toBeVisible();
		await expect(page.getByTestId('create-valkey')).toHaveAttribute('href', NEW_URL);
	});

	test('a full quota hides the create link and says why', async ({ page }) => {
		await mockValkeyApi(page, {
			valkeys: [queueValkey(), cacheValkey(), lockedValkey()],
			quota: { max_valkeys: 3, max_valkey_memory_mb: 256 }
		});
		await page.goto(LIST_URL);
		await expect(page.getByTestId('valkey-quota-blocked')).toContainText(
			'sudah memakai 3 dari 3 Valkey'
		);
		await expect(page.getByTestId('create-valkey')).toHaveCount(0);
	});
});

test.describe('Valkey journeys', () => {
	test('creates a persistent store on its own page and follows it until it is ready', async ({
		page
	}) => {
		const { calls } = await mockValkeyApi(page, { valkeys: [], provisioningReads: 1 });
		await page.goto(LIST_URL);
		await page.getByTestId('create-valkey').first().click();
		await expect(page).toHaveURL(/\/valkeys\/new$/);
		const persistent = page.getByRole('radio', { name: /Persisten/ });
		await expect(persistent).toBeChecked();
		await expect(page.getByTestId('valkey-mode-persistent')).toContainText('Disarankan');
		await expect(page.getByTestId('valkey-mode-persistent')).toContainText('Laravel queue');
		await expect(page.getByRole('radio', { name: '64 MB' })).toBeChecked();
		await expect(page.getByTestId('valkey-size-options')).toContainText('Sisa jatah: 256 MB');

		await page.getByLabel('Nama Valkey').fill('antrean-baru');
		await page.getByTestId('valkey-size-options').getByText('128 MB').click();
		await page.getByTestId('submit-create-valkey').click();

		await expect(page).toHaveURL(/\/valkeys\/valkey-new-0\?workspace=/);
		expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
			name: 'antrean-baru',
			mode: 'persistent',
			maxmemory_mb: 128,
			region: null
		});
		await expect(page.getByTestId('valkey-status-explanation')).toContainText(
			'Server sedang membuat Valkey ini'
		);
		// The page polls every 5 s while the node creates it.
		await expect(page.getByTestId('valkey-status-explanation')).toContainText('Berjalan.', {
			timeout: 15_000
		});
	});

	test('from a project, creates a cache store attached to it in one step', async ({ page }) => {
		const { calls } = await mockValkeyApi(page, { valkeys: [] });
		await page.goto(`${NEW_URL}?project=${PROJECT_ID}`);
		await expect(page.getByTestId('create-valkey-project')).toContainText(attachedProject.name);
		await expect(page.getByLabel('Region')).toHaveCount(0);
		await page.getByTestId('valkey-mode-cache').click();
		await page.getByTestId('submit-create-valkey').click();
		await expect(page).toHaveURL(/\/valkeys\/valkey-new-0\?workspace=/);
		expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
			name: null,
			mode: 'cache',
			maxmemory_mb: 64,
			region: null,
			project_id: PROJECT_ID
		});
	});

	test('explains a refused creation in the workspace numbers', async ({ page }) => {
		await mockValkeyApi(page, {
			valkeys: [],
			create: () => capturedValkey('valkey-create-memory-limit')
		});
		await page.goto(NEW_URL);
		await page.getByLabel('Nama Valkey').fill('sesi');
		await page.getByTestId('submit-create-valkey').click();
		await expect(page.getByTestId('create-valkey-error')).toContainText(
			'Ukuran 128 MB melebihi sisa jatah memori Valkey workspace ini, 64 MB dari 160 MB.'
		);
	});

	test('attaches a project and asks for its redeploy', async ({ page }) => {
		await mockValkeyApi(page, { valkeys: [queueValkey({ projects: [] })] });
		await page.goto(detailUrl());
		await page.getByTestId('attach-valkey').click();
		const dialog = page.getByRole('dialog', { name: 'Pasang ke proyek' });
		await dialog.getByRole('radio', { name: 'api-kasir' }).check();
		await dialog.getByRole('button', { name: 'Pasang Valkey' }).click();
		await expect(page.getByTestId('valkey-redeploy-notices')).toContainText(
			'Redeploy api-kasir supaya aplikasinya tersambung ke Valkey ini.'
		);
	});

	test('explains a project on another server when attaching', async ({ page }) => {
		await mockValkeyApi(page, {
			valkeys: [queueValkey({ projects: [] })],
			attach: () => capturedValkey('attach-node-mismatch')
		});
		await page.goto(detailUrl());
		await page.getByTestId('attach-valkey').click();
		const dialog = page.getByRole('dialog', { name: 'Pasang ke proyek' });
		await dialog.getByRole('radio', { name: 'laporan-web' }).check();
		await dialog.getByRole('button', { name: 'Pasang Valkey' }).click();
		await expect(page.getByTestId('attach-valkey-error')).toContainText(
			'Proyek ini berjalan di server lain'
		);
	});

	test('shows the password to an owner only after Tampilkan, with the variables, then hides it', async ({
		page
	}) => {
		await mockValkeyApi(page);
		await page.goto(detailUrl());
		await expect(page.getByTestId('valkey-credentials')).toContainText('10.213.0.2');
		await expect(page.getByTestId('valkey-env-block')).toHaveCount(0);
		await page.getByTestId('reveal-valkey-credentials').click();
		const block = page.getByTestId('valkey-env-block');
		await expect(block).toContainText('REDIS_URL=redis://:');
		await expect(block).not.toContainText('6379/0');
		await page.getByTestId('hide-valkey-credentials').click();
		await expect(block).toHaveCount(0);
	});

	test('tells a member why the password stays hidden, without asking the API', async ({ page }) => {
		const { calls } = await mockValkeyApi(page, { role: 'member' });
		await page.goto(detailUrl());
		await expect(page.getByTestId('valkey-credentials-owner-only')).toBeVisible();
		expect(calls.some((call) => call.path.endsWith('/credentials'))).toBe(false);
	});

	test('rotates the password with redeploys, saying apps need a redeploy, and links the queued deployment', async ({
		page
	}) => {
		const { calls } = await mockValkeyApi(page);
		await page.goto(detailUrl());
		await page.getByTestId('rotate-valkey-password').click();
		const dialog = page.getByRole('dialog', { name: 'Ganti password Valkey?' });
		await expect(dialog).toContainText('setelah di-redeploy');
		await expect(dialog.getByTestId('rotate-password-redeploy-attached')).toBeChecked();
		await dialog.getByRole('button', { name: 'Ganti password' }).click();
		expect(calls.find((call) => call.path.endsWith('/rotate-password'))?.body).toEqual({
			redeploy_attached: true
		});
		await expect(page.getByTestId('password-rotation-completed')).toBeVisible();
		await expect(
			page
				.getByTestId('password-rotation-completed')
				.getByRole('link', { name: /Lihat deployment/ })
		).toHaveAttribute('href', new RegExp(PASSWORD_ROTATION_DEPLOYMENT_ID));
	});

	test('explains an unknown rotation and keeps the password hidden', async ({ page }) => {
		await mockValkeyApi(page, { valkeys: [unknownRotationValkey()] });
		await page.goto(detailUrl('valkey-unknown'));
		await expect(page.getByTestId('password-rotation-unknown')).toContainText(
			'tidak bisa memastikan password mana yang berlaku'
		);
		await expect(page.getByTestId('reveal-valkey-credentials')).toBeDisabled();
	});

	test('resizes and shows it landing', async ({ page }) => {
		const { calls } = await mockValkeyApi(page);
		await page.goto(detailUrl());
		await page.getByTestId('valkey-resize').getByText('128 MB').click();
		await page.getByTestId('save-valkey-size').click();
		expect(calls.find((call) => call.method === 'PATCH')?.body).toEqual({ maxmemory_mb: 128 });
		await expect(page.getByTestId('valkey-size-value')).toHaveText(/128 MB/, { timeout: 15_000 });
	});

	test('explains a locked store and why it can be locked', async ({ page }) => {
		await mockValkeyApi(page, { valkeys: [lockedValkey()] });
		await page.goto(detailUrl('valkey-locked'));
		await expect(page.getByTestId('valkey-status-explanation')).toContainText(
			'aplikasi tidak bisa login'
		);
		await expect(page.getByTestId('valkey-locked-why')).toContainText(
			'semua proyek yang memakainya sedang ditangguhkan'
		);
	});

	test('blocks deleting while attached, then detaches and deletes with the name typed', async ({
		page
	}) => {
		await mockValkeyApi(page);
		await page.goto(detailUrl());
		await expect(page.getByTestId('delete-valkey')).toBeDisabled();
		await expect(page.getByTestId('valkey-delete-blocked')).toContainText('toko-kopi-web');

		await page.getByRole('button', { name: `Lepas dari ${attachedProject.name}` }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Lepas Valkey' }).click();
		await expect(page.getByTestId('valkey-redeploy-notices')).toContainText(
			'berhenti memakai Valkey ini'
		);
		await expect(page.getByTestId('delete-valkey')).toBeEnabled();
		await page.getByTestId('delete-valkey').click();
		const dialog = page.getByRole('dialog', { name: /^Hapus / });
		await dialog.getByLabel(/untuk konfirmasi/).fill('antrean-toko');
		await dialog.getByRole('button', { name: 'Hapus Valkey ini' }).click();
		await expect(page).toHaveURL(/\/valkeys$/);
	});
});

test.describe('Valkey on a project', () => {
	test('lists the injected variables with hidden values and suggests the Laravel ones', async ({
		page
	}) => {
		const added: unknown[] = [];
		await mockValkeyApi(page, {
			project: { stack: laravelStack },
			envList: [
				{
					id: 1,
					key: 'QUEUE_CONNECTION',
					value: 'database',
					is_secret: false,
					created_at: '2026-01-01T00:00:00Z'
				}
			],
			addEnv: (body) => {
				added.push(body);
				return { status: 201, body: { data: { id: 2, ...body } } };
			}
		});
		await page.goto(ENV_URL);
		const section = page.getByTestId('valkey-variables');
		await expect(section).toContainText('Dari Valkey antrean-toko');
		for (const name of ['REDIS_URL', 'REDIS_HOST', 'REDIS_PORT', 'REDIS_PASSWORD']) {
			await expect(page.getByTestId(`valkey-variable-${name}`)).toContainText(
				'nilai disembunyikan'
			);
		}
		await expect(page.getByTestId('valkey-laravel-different-QUEUE_CONNECTION')).toContainText(
			'sekarang database'
		);
		await page.getByTestId('add-valkey-laravel-variables').click();
		await expect
			.poll(() => added)
			.toEqual([{ key: 'CACHE_STORE', value: 'redis', is_secret: false }]);
	});

	test('attaches a store from the project and shows the redeploy notice', async ({ page }) => {
		await mockValkeyApi(page, { valkeys: [queueValkey({ projects: [] }), cacheValkey()] });
		await page.goto(ENV_URL);
		await page.getByTestId('attach-project-valkey').click();
		const dialog = page.getByRole('dialog', { name: 'Pasang Valkey' });
		await dialog.getByRole('radio', { name: /antrean-toko/ }).check();
		await dialog.getByRole('button', { name: 'Pasang Valkey' }).click();
		await expect(page.getByTestId('valkey-variables')).toContainText('Dari Valkey antrean-toko');
		await expect(page.getByRole('button', { name: 'Redeploy sekarang' })).toBeVisible();
	});

	test('detaches from the project after a confirmation', async ({ page }) => {
		await mockValkeyApi(page);
		await page.goto(ENV_URL);
		await page.getByTestId('detach-project-valkey').click();
		await page.getByRole('dialog').getByRole('button', { name: 'Lepas Valkey' }).click();
		await expect(page.getByTestId('valkey-variables')).toHaveCount(0);
		await expect(page.getByTestId('valkey-variables-offer')).toBeVisible();
	});

	test('a redeploy refused because the store is on another server says what to do', async ({
		page
	}) => {
		await mockValkeyApi(page, {
			project: { redeploy_required: true },
			redeploy: () => capturedValkey('deploy-node-mismatch')
		});
		await page.goto(ENV_URL);
		await page.getByRole('button', { name: 'Redeploy sekarang' }).click();
		await expect(page.getByRole('alert').filter({ hasText: 'server lain' })).toContainText(
			'Lepas Valkey itu di tab Variabel'
		);
	});
});

test.describe('Valkey pages meet the floor', () => {
	for (const width of [320, 1280] as const) {
		test(`list, create, detail, and the project at ${width} px`, async ({ page }) => {
			await page.setViewportSize({ width, height: 800 });
			await mockValkeyApi(page, {
				valkeys: [provisioningValkey(), cacheValkey(), queueValkey(), lockedValkey()],
				quota: { max_valkeys: 5, max_valkey_memory_mb: 512 },
				project: { stack: laravelStack }
			});
			for (const path of [
				LIST_URL,
				NEW_URL,
				`${NEW_URL}?project=${PROJECT_ID}`,
				detailUrl(),
				detailUrl('valkey-cache'),
				detailUrl('valkey-locked'),
				detailUrl('valkey-provisioning'),
				ENV_URL
			]) {
				await page.goto(path);
				await settled(page);
				const audit = await auditDom(page, 24, width < 768 ? 44 : 24);
				const at = `${path} at ${width} px`;
				expect.soft(audit.overflow, `${at}: nothing past the viewport`).toEqual([]);
				expect.soft(audit.contrast, `${at}: text contrast`).toEqual([]);
				expect.soft(audit.controls, `${at}: edge of inputs`).toEqual([]);
				expect.soft(audit.targets, `${at}: targets of at least 24 px`).toEqual([]);
				expect.soft(audit.primaryTargets, `${at}: primary actions on touch`).toEqual([]);
				expect.soft(audit.h1, `${at}: exactly one h1`).toBe(1);
				expect.soft(audit.main, `${at}: exactly one main`).toBe(1);
				expect.soft(audit.title, `${at}: a title of its own`).toMatch(/· Sakala$/);
			}
		});
	}

	test('the create page works by keyboard alone', async ({ page }) => {
		const { calls } = await mockValkeyApi(page, { valkeys: [] });
		await page.goto(NEW_URL);
		await settled(page);
		await page.getByLabel('Nama Valkey').focus();
		await page.keyboard.type('kbd');
		// Name, then the mode group: arrows move between the two modes.
		await page.keyboard.press('Tab');
		await expect(page.getByRole('radio', { name: /Persisten/ })).toBeFocused();
		await page.keyboard.press('ArrowRight');
		await expect(page.getByRole('radio', { name: /Cache/ })).toBeChecked();
		await page.keyboard.press('Tab');
		await expect(page.getByRole('radio', { name: '64 MB' })).toBeFocused();
		await page.keyboard.press('ArrowLeft');
		await expect(page.getByRole('radio', { name: '32 MB' })).toBeChecked();
		await page.getByTestId('submit-create-valkey').focus();
		await page.keyboard.press('Enter');
		await expect(page).toHaveURL(/\/valkeys\/valkey-new-0/);
		expect(calls.find((call) => call.method === 'POST')?.body).toMatchObject({
			name: 'kbd',
			mode: 'cache',
			maxmemory_mb: 32
		});
	});
});

/**
 * Screenshots for the pull request, written only when VALKEY_SCREENSHOTS names a folder, so CI does
 * not spend time on them.
 */
const SCREENSHOT_DIR = process.env.VALKEY_SCREENSHOTS;
const SCREENSHOT_HEIGHT = 900;
const SCREENSHOT_MAX_HEIGHT = 4000;

async function fullShot(page: Page, path: string, width: number) {
	await settled(page);
	const height = await page.evaluate(() =>
		Math.max(...Array.from(document.querySelectorAll('*'), (element) => element.scrollHeight))
	);
	await page.setViewportSize({ width, height: Math.min(height + 48, SCREENSHOT_MAX_HEIGHT) });
	await page.screenshot({ path });
	await page.setViewportSize({ width, height: SCREENSHOT_HEIGHT });
}

test.describe('screenshots', () => {
	test.skip(!SCREENSHOT_DIR, 'set VALKEY_SCREENSHOTS to write them');
	test.describe.configure({ timeout: 180_000 });

	for (const width of [1440, 320] as const) {
		test(`journeys at ${width} px`, async ({ page }) => {
			const dir = SCREENSHOT_DIR!;
			await mkdir(dir, { recursive: true });
			await page.setViewportSize({ width, height: SCREENSHOT_HEIGHT });
			const shot = (name: string) => fullShot(page, `${dir}/${name}-${width}.png`, width);

			await mockValkeyApi(page, {
				valkeys: [provisioningValkey(), cacheValkey(), queueValkey(), lockedValkey()],
				quota: { max_valkeys: 5, max_valkey_memory_mb: 512 },
				project: { stack: laravelStack },
				envList: [
					{
						id: 1,
						key: 'QUEUE_CONNECTION',
						value: 'database',
						is_secret: false,
						created_at: '2026-01-01T00:00:00Z'
					}
				]
			});
			await page.goto(LIST_URL);
			await shot('list');

			await page.goto(NEW_URL);
			await page.getByLabel('Nama Valkey').fill('antrean-toko');
			await shot('create');

			await page.goto(detailUrl());
			await shot('detail');
			await page.getByTestId('reveal-valkey-credentials').click();
			await expect(page.getByTestId('valkey-env-block')).toBeVisible();
			await shot('detail-credentials-owner');
			await page.getByTestId('rotate-valkey-password').click();
			await page.waitForTimeout(300);
			await page.screenshot({ path: `${dir}/rotate-dialog-${width}.png` });
			await page
				.getByRole('dialog', { name: 'Ganti password Valkey?' })
				.getByRole('button', { name: 'Ganti password' })
				.click();
			await expect(page.getByTestId('password-rotation-completed')).toBeVisible();
			await shot('rotation-completed');

			await page.goto(detailUrl('valkey-cache'));
			await page.getByTestId('valkey-resize').getByText('128 MB').click();
			await shot('detail-cache-warning-resize');

			await page.goto(detailUrl('valkey-locked'));
			await shot('detail-locked');

			await page.goto(detailUrl('valkey-provisioning'));
			await shot('detail-provisioning');

			await page.goto(ENV_URL);
			await shot('project-variables');
		});

		test(`states at ${width} px`, async ({ page }) => {
			const dir = SCREENSHOT_DIR!;
			await mkdir(dir, { recursive: true });
			await page.setViewportSize({ width, height: SCREENSHOT_HEIGHT });

			await mockValkeyApi(page, { valkeys: [] });
			await page.goto(LIST_URL);
			await fullShot(page, `${dir}/empty-${width}.png`, width);

			await page.unrouteAll({ behavior: 'ignoreErrors' });
			await mockValkeyApi(page, { valkeys: [queueValkey({ projects: [] }), cacheValkey()] });
			await page.goto(ENV_URL);
			await page.getByTestId('attach-project-valkey').click();
			await page.waitForTimeout(300);
			await page.screenshot({ path: `${dir}/project-attach-dialog-${width}.png` });

			await page.unrouteAll({ behavior: 'ignoreErrors' });
			await mockValkeyApi(page, { role: 'member' });
			await page.goto(detailUrl());
			await fullShot(page, `${dir}/detail-member-${width}.png`, width);

			await page.unrouteAll({ behavior: 'ignoreErrors' });
			await mockValkeyApi(page, {
				valkeys: [],
				quota: { max_valkeys: 0, max_valkey_memory_mb: 0 }
			});
			await page.goto(LIST_URL);
			await fullShot(page, `${dir}/no-quota-${width}.png`, width);

			await page.unrouteAll({ behavior: 'ignoreErrors' });
			await mockValkeyApi(page, { enabled: false });
			await page.goto(ENV_URL);
			await fullShot(page, `${dir}/flag-off-project-${width}.png`, width);
			await page.goto('/projects');
			await fullShot(page, `${dir}/flag-off-sidebar-${width}.png`, width);
		});
	}
});

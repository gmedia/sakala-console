import { mkdir } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import {
	attachedProject,
	capturedDatabase,
	DATABASE_ID,
	lockedDatabase,
	mockDatabaseApi,
	provisioningDatabase,
	ROTATION_DEPLOYMENT_ID,
	sampleDatabases
} from './fixtures/databases';
import { auditDom } from './fixtures/dom-audit';
import { PROJECT_ID } from './fixtures/project-detail';

const LIST_URL = '/databases';
const detailUrl = (id = DATABASE_ID) => `/databases/${id}`;

async function settled(page: Page) {
	await page.waitForLoadState('networkidle');
	await expect(page.locator('main')).toHaveCount(1);
}

test.describe('database list', () => {
	test('lists each database with its status, size, projects, and region, under the quota', async ({
		page
	}) => {
		await mockDatabaseApi(page);
		await page.goto(LIST_URL);

		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Database');
		await expect(page.getByRole('link', { name: 'Database', exact: true }).first()).toHaveAttribute(
			'aria-current',
			'page'
		);
		const rows = page.getByTestId('database-row');
		await expect(rows).toHaveCount(3);
		await expect(rows.nth(0)).toContainText('toko-kopi-db');
		await expect(rows.nth(0)).toContainText('Siap');
		await expect(rows.nth(0)).toContainText(attachedProject.name);
		await expect(rows.nth(0)).toContainText('12 MB dari 512 MB');
		await expect(rows.nth(0)).toContainText('jkt');
		await expect(rows.nth(2)).toContainText('Gagal');
		await expect(rows.nth(2)).toContainText('Gagal dibuat. Hapus lalu buat lagi.');

		await expect(page.getByTestId('database-quota-count')).toHaveText('2 dari 3 database');
		await expect(page.getByTestId('database-quota-storage')).toContainText('20 MB dari 512 MB');
	});

	test('shows a provisioning database as in progress and a locked one with the reason', async ({
		page
	}) => {
		await mockDatabaseApi(page, {
			databases: [provisioningDatabase(), lockedDatabase()],
			quota: { max_databases: 3, max_database_storage_mb: 512 }
		});
		await page.goto(LIST_URL);

		const rows = page.getByTestId('database-row');
		await expect(rows.nth(0)).toContainText('Menyiapkan');
		await expect(rows.nth(0)).toContainText('Sedang dibuat di server database');
		await expect(rows.nth(1)).toContainText('Terkunci');
		await expect(rows.nth(1)).toContainText(
			'Aplikasi tidak bisa terhubung karena penyimpanan workspace penuh'
		);
		await expect(page.getByTestId('database-quota-storage')).toContainText('penuh');
		await expect(page.getByTestId('database-quota-blocked')).toContainText(
			'database baru akan langsung terkunci'
		);
	});

	test('explains what a database is when there is none, with one way to create it', async ({
		page
	}) => {
		await mockDatabaseApi(page, { databases: [] });
		await page.goto(LIST_URL);

		await expect(page.getByRole('heading', { name: /Belum ada database di/ })).toBeVisible();
		await expect(
			page.getByText(/Sakala menambahkan DATABASE_URL dan variabel DB_\*/)
		).toBeVisible();
		await expect(page.getByTestId('create-database')).toHaveCount(1);
		await expect(page.getByTestId('database-quota-count')).toHaveText('0 dari 3 database');
	});

	test('a viewer reads the list but cannot create', async ({ page }) => {
		await mockDatabaseApi(page, { role: 'viewer' });
		await page.goto(LIST_URL);

		await expect(page.getByTestId('database-row')).toHaveCount(3);
		await expect(page.getByTestId('create-database')).toHaveCount(0);
		await expect(page.getByTestId('database-viewer-note')).toBeVisible();
	});
});

test('a database on a node without a region reads Otomatis, never "tanpa region"', async ({
	page
}) => {
	const databases = sampleDatabases().map((database, index) =>
		index === 0 ? { ...database, region: null } : database
	);
	await mockDatabaseApi(page, { databases });
	await page.goto(LIST_URL);
	await expect(page.getByRole('main')).not.toContainText('tanpa region');
	await expect(page.getByRole('main')).toContainText('Otomatis');

	await page.goto(detailUrl());
	await expect(page.getByTestId('database-region-auto')).toHaveText('region otomatis');
	await expect(page.getByTestId('database-overview')).not.toContainText('tanpa region');
});

test.describe('an installation without a database server', () => {
	test('says databases are not offered here, with no way to create one', async ({ page }) => {
		await mockDatabaseApi(page, { databases: [], databasesAvailable: false, role: 'owner' });
		await page.goto(LIST_URL);

		await expect(
			page.getByRole('heading', { name: 'Database terkelola belum tersedia di server ini' })
		).toBeVisible();
		await expect(
			page.getByText('Belum ada server database yang terhubung ke Sakala ini')
		).toBeVisible();
		await expect(page.getByTestId('create-database')).toHaveCount(0);
		// The sidebar keeps the page, so people can find it and read why.
		await expect(page.getByRole('link', { name: 'Database', exact: true }).first()).toBeVisible();
	});

	test('still lists existing databases, without the create action', async ({ page }) => {
		await mockDatabaseApi(page, { databasesAvailable: false, role: 'owner' });
		await page.goto(LIST_URL);

		await expect(page.getByTestId('databases-unavailable')).toContainText(
			'Database terkelola belum tersedia di server ini'
		);
		await expect(page.getByRole('link', { name: 'toko-kopi-db' })).toBeVisible();
		await expect(page.getByTestId('create-database')).toHaveCount(0);
	});
});

test.describe('creating a database', () => {
	test('creates one in the automatic region and follows it until it is ready', async ({ page }) => {
		const { calls } = await mockDatabaseApi(page, { provisioningReads: 1 });
		await page.goto(LIST_URL);

		await page.getByTestId('create-database').click();
		const dialog = page.getByRole('dialog', { name: 'Buat database' });
		await expect(dialog.getByLabel('Region')).toHaveValue('');
		await expect(dialog.getByText(/tidak punya region bawaan/)).toBeVisible();

		await dialog.getByRole('button', { name: 'Buat database' }).click();
		await expect(dialog.getByText('Isi nama database')).toBeVisible();

		await dialog.getByLabel('Nama database').fill('kasir-db');
		await dialog.getByRole('button', { name: 'Buat database' }).click();

		await expect(page).toHaveURL(/\/databases\/db-new-3\?workspace=/);
		expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
			name: 'kasir-db',
			region: null
		});
		await expect(page.getByRole('heading', { level: 1 })).toContainText('kasir-db');
		const explanation = page.getByTestId('database-status-explanation');
		await expect(explanation).toContainText('Server database sedang membuat database ini');
		await expect(explanation.getByRole('list', { name: 'Tahap pembuatan' })).toBeVisible();

		// The page polls while the node works, then shows the database as ready.
		await expect(explanation).toContainText('Menerima koneksi', { timeout: 15_000 });
		await expect(explanation.getByRole('list', { name: 'Tahap pembuatan' })).toHaveCount(0);
	});

	test('names the team default region behind Otomatis', async ({ page }) => {
		await mockDatabaseApi(page, { role: 'owner' });
		await page.goto(LIST_URL);
		await page.getByTestId('create-database').click();
		const dialog = page.getByRole('dialog', { name: 'Buat database' });
		await expect(dialog.getByLabel('Region').locator('option').first()).toHaveText(
			'Otomatis (jkt)'
		);
		await expect(dialog.getByText('Memakai region bawaan workspace, jkt.')).toBeVisible();
	});

	test('explains a refusal from the quota in the dialog', async ({ page }) => {
		await mockDatabaseApi(page, {
			handlers: { create: () => capturedDatabase('database-create-limit') }
		});
		await page.goto(LIST_URL);
		await page.getByTestId('create-database').click();
		const dialog = page.getByRole('dialog', { name: 'Buat database' });
		await dialog.getByLabel('Nama database').fill('satu-lagi');
		await dialog.getByLabel('Region').selectOption('jkt');
		await dialog.getByRole('button', { name: 'Buat database' }).click();

		await expect(dialog.getByTestId('create-database-error')).toHaveText(
			'Workspace ini sudah memakai 3 dari 3 database. Hapus database yang tidak dipakai, atau minta admin Sakala menaikkan batasnya.'
		);
	});

	test('says why before the form when the quota is used up', async ({ page }) => {
		await mockDatabaseApi(page, { quota: { max_databases: 2, max_database_storage_mb: 512 } });
		await page.goto(LIST_URL);
		await page.getByTestId('create-database').click();

		const dialog = page.getByRole('dialog', { name: 'Buat database' });
		await expect(dialog.getByTestId('create-database-blocked')).toContainText(
			'sudah memakai 2 dari 2 database'
		);
		await expect(dialog.getByLabel('Nama database')).toHaveCount(0);
	});

	test('from a project, preselects its region and opens attaching on the database page', async ({
		page
	}) => {
		// The project has no database yet, which is when its Variabel tab links here.
		await mockDatabaseApi(page, {
			databases: sampleDatabases().map((database) => ({
				...database,
				projects: database.projects.filter((project) => project.id !== PROJECT_ID)
			})),
			project: { region: 'sby', databases: [] }
		});
		await page.goto(`${LIST_URL}?project=${PROJECT_ID}`);

		await expect(page.getByTestId('database-project-context')).toContainText(attachedProject.name);
		await page.getByTestId('create-database').click();
		await expect(page.getByRole('dialog').getByLabel('Region')).toHaveValue('sby');
		await page.keyboard.press('Escape');

		await page.getByRole('link', { name: 'analitik' }).click();
		const attach = page.getByRole('dialog', { name: 'Pasang ke proyek' });
		await expect(attach).toBeVisible();
		await expect(attach.getByTestId('attach-selected')).toContainText(attachedProject.name);
	});
});

test.describe('database detail', () => {
	test('attaches a project and asks for its redeploy', async ({ page }) => {
		await mockDatabaseApi(page);
		await page.goto(detailUrl());

		await page.getByTestId('attach-project').click();
		const dialog = page.getByRole('dialog', { name: 'Pasang ke proyek' });
		await expect(dialog.getByRole('radio', { name: /toko-kopi-web/ })).toBeDisabled();
		await expect(dialog.getByText('sudah terpasang')).toBeVisible();
		await expect(dialog.getByRole('radio', { name: /laporan-web/ })).toBeDisabled();
		await expect(dialog.getByText('memakai analitik')).toBeVisible();

		await dialog.getByRole('button', { name: 'Pasang database' }).click();
		await expect(dialog.getByTestId('attach-error')).toHaveText(
			'Pilih proyek yang akan memakai database ini.'
		);
		await dialog.getByRole('radio', { name: 'api-kasir' }).check();
		await dialog.getByRole('button', { name: 'Pasang database' }).click();

		const projects = page.getByTestId('database-projects');
		await expect(projects.getByRole('link', { name: 'api-kasir', exact: true })).toBeVisible();
		const notices = page.getByTestId('redeploy-notices');
		await expect(notices).toContainText(
			'Redeploy api-kasir supaya aplikasinya menerima variabel koneksi database ini.'
		);
		await expect(notices.getByRole('link', { name: /Buka proyek untuk redeploy/ })).toHaveAttribute(
			'href',
			'/projects/p-kasir/environments'
		);
	});

	test('explains a cross-region refusal in the attach dialog', async ({ page }) => {
		await mockDatabaseApi(page, {
			handlers: { attach: () => capturedDatabase('attach-cross-region') }
		});
		await page.goto(detailUrl());
		await page.getByTestId('attach-project').click();
		const dialog = page.getByRole('dialog', { name: 'Pasang ke proyek' });
		await dialog.getByRole('radio', { name: 'panel-admin' }).check();
		await dialog.getByRole('button', { name: 'Pasang database' }).click();
		await expect(dialog.getByTestId('attach-error')).toContainText(
			'Database dan proyek harus di region yang sama'
		);
	});

	test('blocks deleting while attached, then detaches and deletes with the name typed', async ({
		page
	}) => {
		const { store } = await mockDatabaseApi(page);
		await page.goto(detailUrl());

		await expect(page.getByTestId('delete-database')).toBeDisabled();
		await expect(page.getByTestId('delete-blocked')).toContainText(
			`Masih dipasang ke ${attachedProject.name}`
		);

		await page.getByRole('button', { name: `Lepas dari ${attachedProject.name}` }).click();
		const detach = page.getByRole('dialog', { name: 'Lepas toko-kopi-db?' });
		await expect(detach).toContainText('Data di database tetap ada');
		await detach.getByRole('button', { name: 'Lepas database' }).click();
		await expect(page.getByTestId('redeploy-notices')).toContainText(
			`Redeploy ${attachedProject.name} supaya aplikasinya berhenti memakai database ini.`
		);

		await page.getByTestId('delete-database').click();
		const dialog = page.getByRole('dialog', { name: 'Hapus toko-kopi-db?' });
		const confirm = dialog.getByRole('button', { name: 'Hapus database ini' });
		await expect(confirm).toBeDisabled();
		await dialog.getByLabel(/untuk konfirmasi/).fill('toko-kopi-db');
		await confirm.click();

		await expect(page).toHaveURL(/\/databases$/);
		expect(store.find((database) => database.id === DATABASE_ID)?.status).toBe('deleting');
		await expect(page.getByTestId('database-row').first()).toContainText('Menghapus');
	});

	test('shows credentials to an owner only after Tampilkan, and hides them again', async ({
		page
	}) => {
		const { calls } = await mockDatabaseApi(page);
		await page.goto(detailUrl());

		const connection = page.getByTestId('database-connection');
		await expect(connection.getByText('Setiap kali password ditampilkan')).toBeVisible();
		await expect(connection).toContainText('10.0.47.30');
		expect(calls.some((call) => call.path.endsWith('/credentials'))).toBe(false);
		await expect(connection.getByRole('img', { name: 'Disembunyikan' })).toHaveCount(2);

		await page.getByTestId('reveal-credentials').click();
		const credentials = capturedDatabase<{ data: Record<string, string> }>('credentials').body.data;
		await expect(connection).toContainText(credentials.password);
		await expect(connection.getByRole('button', { name: 'Salin DATABASE_URL' })).toBeVisible();

		await connection.getByRole('button', { name: 'Sembunyikan' }).click();
		await expect(connection).not.toContainText(credentials.password);
	});

	test('tells a member why credentials stay hidden, and lets them rotate the password', async ({
		page
	}) => {
		const { calls } = await mockDatabaseApi(page, { role: 'member' });
		await page.goto(detailUrl());

		await expect(page.getByTestId('credentials-owner-only')).toContainText(
			'Password dan DATABASE_URL hanya bisa dilihat pemilik workspace'
		);
		await expect(page.getByTestId('database-connection')).toContainText('10.0.47.30');
		await expect(page.getByTestId('reveal-credentials')).toHaveCount(0);

		await page.getByTestId('rotate-password').click();
		const dialog = page.getByRole('dialog', { name: 'Ganti password database?' });
		await expect(dialog).toContainText('Password lama langsung tidak berlaku');
		await expect(dialog).toContainText(attachedProject.name);
		await expect(
			dialog.getByRole('checkbox', { name: 'Redeploy otomatis proyek yang terpasang' })
		).toBeChecked();
		await dialog.getByRole('button', { name: 'Ganti password' }).click();

		// Pending first, then the page polls until the node reported and the redeploy is queued.
		await expect(page.getByTestId('rotation-pending')).toBeVisible();
		await expect(page.getByTestId('rotation-completed')).toContainText(
			'Password sudah diganti pukul'
		);
		const row = page.getByTestId(`rotation-project-${attachedProject.id}`);
		await expect(row).toContainText('Redeploy otomatis berjalan');
		await expect(row.getByRole('link', { name: /Lihat deployment/ })).toHaveAttribute(
			'href',
			`/projects/${attachedProject.id}/deployments/${ROTATION_DEPLOYMENT_ID}`
		);
		expect(calls.find((call) => call.path.endsWith('/rotate-password'))?.body).toEqual({
			redeploy_attached: true
		});
	});

	test('a rotation without redeploys offers a Redeploy button per project', async ({ page }) => {
		const { calls } = await mockDatabaseApi(page, {
			role: 'owner',
			project: { redeploy_required: true }
		});
		await page.goto(detailUrl());

		await page.getByTestId('rotate-password').click();
		const dialog = page.getByRole('dialog', { name: 'Ganti password database?' });
		await dialog.getByRole('checkbox').uncheck();
		await dialog.getByRole('button', { name: 'Ganti password' }).click();

		const row = page.getByTestId(`rotation-project-${attachedProject.id}`);
		await expect(row).toContainText('Masih memakai password lama');
		await expect(
			row.getByRole('button', { name: `Redeploy ${attachedProject.name}` })
		).toBeVisible();
		expect(calls.find((call) => call.path.endsWith('/rotate-password'))?.body).toEqual({
			redeploy_attached: false
		});
	});

	test('a viewer sees no actions on the database page', async ({ page }) => {
		await mockDatabaseApi(page, { role: 'viewer' });
		await page.goto(detailUrl());

		await expect(page.getByTestId('database-overview')).toBeVisible();
		await expect(page.getByTestId('attach-project')).toHaveCount(0);
		await expect(page.getByTestId('rotate-password')).toHaveCount(0);
		await expect(page.getByTestId('delete-database')).toHaveCount(0);
		await expect(page.getByTestId('credentials-owner-only')).toBeVisible();
	});

	test('installs an extension and shows a failed install from the API', async ({ page }) => {
		const analytics = sampleDatabases()[1];
		await mockDatabaseApi(page);
		await page.goto(detailUrl(analytics.id));

		const extensions = page.getByTestId('database-extensions');
		await expect(extensions.getByTestId('extension-failure')).toContainText(
			'Extension ini belum tersedia di server database'
		);
		await extensions.getByRole('button', { name: 'Pasang pg_trgm' }).click();
		await expect(extensions.getByTestId('extension-requested-pg_trgm')).toHaveText('Diminta');
	});

	test('explains a locked database and why it cannot be attached', async ({ page }) => {
		const locked = lockedDatabase();
		await mockDatabaseApi(page, { databases: [locked] });
		await page.goto(detailUrl(locked.id));

		const explanation = page.getByTestId('database-status-explanation');
		await expect(explanation).toContainText('aplikasi tidak bisa terhubung');
		await expect(explanation).toContainText('Pemakaian workspace sekarang: 520 MB dari 512 MB');
		await expect(page.getByTestId('attach-project')).toBeDisabled();
		await expect(page.getByText('Database yang terkunci belum bisa dipasang')).toBeVisible();
		// The superuser still reaches a locked database, so the password can be rotated.
		await expect(page.getByTestId('rotate-password')).toBeEnabled();
	});

	test('points migrations to the release command', async ({ page }) => {
		await mockDatabaseApi(page);
		await page.goto(detailUrl());
		const help = page.getByTestId('database-help');
		await expect(help.getByRole('link', { name: /Release command/ })).toHaveAttribute(
			'href',
			'https://sakala.dev/docs/perintah-rilis'
		);
		// Folded until asked for, like every how-to in the panel.
		const hint = page.getByTestId('database-release-hint');
		await expect(hint.getByText('php artisan migrate --force')).toBeHidden();
		await hint.locator('summary').click();
		await expect(hint).toContainText('php artisan migrate --force');
	});

	test('says so when the database no longer exists', async ({ page }) => {
		await mockDatabaseApi(page);
		await page.goto(detailUrl('db-hilang'));
		await expect(page.getByRole('heading', { name: 'Database tidak ditemukan' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Lihat semua database' })).toBeVisible();
	});
});

const projectDatabase = (overrides: Record<string, unknown> = {}) => ({
	id: DATABASE_ID,
	name: 'toko-kopi-db',
	status: 'ready',
	region: 'jkt',
	variables: [
		'DATABASE_URL',
		'DB_CONNECTION',
		'DB_PORT',
		'DB_DATABASE',
		'DB_USERNAME',
		'DB_PASSWORD'
	],
	overridden_variables: ['DB_HOST'],
	...overrides
});

test.describe('the project side', () => {
	test('the overview draws the attached database and links to it', async ({ page }) => {
		await mockDatabaseApi(page, { project: { databases: [projectDatabase()] } });
		await page.goto(`/projects/${PROJECT_ID}`);

		const block = page.getByTestId('topology-block-database');
		await expect(block).toContainText('toko-kopi-db');
		await expect(block).toContainText('Siap');
		await block.click();
		const detail = page.getByTestId('topology-detail-database');
		await expect(detail).toContainText('menimpa DB_HOST');
		await detail.getByRole('link', { name: 'Buka database' }).click();
		await expect(page).toHaveURL(new RegExp(`/databases/${DATABASE_ID}\\?workspace=`));
		await expect(page.getByTestId('database-overview')).toBeVisible();
	});

	test('the variables tab lists the injected variables and flags the overridden one', async ({
		page
	}) => {
		await mockDatabaseApi(page, {
			project: {
				databases: [projectDatabase()],
				stack: {
					builder: 'railpack',
					provider: 'php',
					framework: 'laravel',
					package_manager: 'composer'
				},
				release_command: null
			},
			envList: [
				{
					id: 1,
					key: 'DB_HOST',
					value: 'db.example.test',
					is_secret: false,
					created_at: '2026-01-01T00:00:00Z'
				}
			]
		});
		await page.goto(`/projects/${PROJECT_ID}/environments`);

		const section = page.getByTestId('database-variables');
		await expect(section).toContainText('Dari database toko-kopi-db');
		await expect(
			section
				.getByTestId('database-variable-DATABASE_URL')
				.getByRole('img', { name: 'Nilai dari database toko-kopi-db, disembunyikan' })
		).toBeVisible();
		await expect(section.getByTestId('database-variable-DB_HOST')).toContainText('Ditimpa proyek');
		await expect(page.getByTestId('env-overrides-database')).toHaveText('Menimpa database');
		await expect(page.getByTestId('database-release-hint-laravel')).toContainText(
			'php artisan migrate --force'
		);
	});

	test('a project without a database is pointed at the database page', async ({ page }) => {
		await mockDatabaseApi(page, { project: { databases: [] } });
		await page.goto(`/projects/${PROJECT_ID}/environments`);
		await expect(page.getByRole('link', { name: 'Pilih atau buat database' })).toHaveAttribute(
			'href',
			`/databases?project=${PROJECT_ID}`
		);
	});
});

test.describe('database pages meet the floor', () => {
	for (const width of [320, 1280] as const) {
		test(`list and detail at ${width} px`, async ({ page }) => {
			await page.setViewportSize({ width, height: 800 });
			await mockDatabaseApi(page, {
				databases: [...sampleDatabases(), provisioningDatabase(), lockedDatabase()]
			});
			for (const path of [LIST_URL, detailUrl(), detailUrl(lockedDatabase().id)]) {
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

	test('the list and the create dialog work by keyboard alone', async ({ page }) => {
		await mockDatabaseApi(page);
		await page.goto(LIST_URL);
		await settled(page);

		await page.getByTestId('create-database').focus();
		await page.keyboard.press('Enter');
		const dialog = page.getByRole('dialog', { name: 'Buat database' });
		await expect(dialog).toBeVisible();
		await expect(dialog.getByLabel('Nama database')).toBeFocused();
		await page.keyboard.press('Escape');
		await expect(dialog).toHaveCount(0);
		await expect(page.getByTestId('create-database')).toBeFocused();
	});
});

/**
 * Screenshots for the pull request, written only when DATABASE_SCREENSHOTS names a folder, so CI
 * does not spend time on them.
 */
const SCREENSHOT_DIR = process.env.DATABASE_SCREENSHOTS;
const SCREENSHOT_HEIGHT = 900;
const SCREENSHOT_MAX_HEIGHT = 4000;

/** The shell scrolls inside itself, so a full-page shot grows the viewport to the content. */
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
	test.skip(!SCREENSHOT_DIR, 'set DATABASE_SCREENSHOTS to write them');
	test.describe.configure({ timeout: 120_000 });

	for (const width of [1440, 320] as const) {
		test(`at ${width} px`, async ({ page }) => {
			const dir = SCREENSHOT_DIR!;
			await mkdir(dir, { recursive: true });
			await page.setViewportSize({ width, height: SCREENSHOT_HEIGHT });
			const shot = (name: string) => fullShot(page, `${dir}/${name}-${width}.png`, width);

			await mockDatabaseApi(page, {
				databases: [provisioningDatabase(), ...sampleDatabases()],
				quota: { max_databases: 5, max_database_storage_mb: 512 },
				project: {
					databases: [projectDatabase()],
					stack: {
						builder: 'railpack',
						provider: 'php',
						framework: 'laravel',
						package_manager: 'composer'
					},
					release_command: null
				},
				envList: [
					{
						id: 1,
						key: 'DB_HOST',
						value: 'db.example.test',
						is_secret: false,
						created_at: '2026-01-01T00:00:00Z'
					}
				]
			});
			await page.goto(LIST_URL);
			await shot('list');

			await page.getByTestId('create-database').click();
			await page.getByRole('dialog').getByLabel('Nama database').fill('kasir-db');
			await page.waitForTimeout(300);
			await page.screenshot({ path: `${dir}/create-dialog-${width}.png` });
			await page.keyboard.press('Escape');

			await page.goto(detailUrl());
			await shot('detail');
			await page.getByTestId('reveal-credentials').click();
			await expect(page.getByTestId('credentials')).toContainText('10.0.47.30');
			await shot('detail-credentials');

			await page.goto(detailUrl('db-provisioning'));
			await shot('detail-provisioning');

			await page.goto(`/projects/${PROJECT_ID}`);
			await settled(page);
			await page.getByTestId('topology-block-database').click();
			await page.waitForTimeout(300);
			await page.screenshot({ path: `${dir}/project-overview-${width}.png` });

			await page.goto(`/projects/${PROJECT_ID}/environments`);
			await shot('project-variables');
		});

		test(`rotation, region, and deploy states at ${width} px`, async ({ page }) => {
			const dir = SCREENSHOT_DIR!;
			await mkdir(dir, { recursive: true });
			await page.setViewportSize({ width, height: SCREENSHOT_HEIGHT });
			const databases = sampleDatabases().map((database, index) =>
				index === 0 ? { ...database, region: null } : database
			);
			await mockDatabaseApi(page, {
				databases,
				role: 'owner',
				project: {
					runtime_status: 'deploying',
					databases: [projectDatabase({ region: null })]
				},
				envList: [
					{
						id: 1,
						key: 'APP_KEY',
						value: 'base64:example',
						is_secret: true,
						created_at: '2026-01-01T00:00:00Z'
					}
				]
			});
			await page.goto(LIST_URL);
			await fullShot(page, `${dir}/list-region-auto-${width}.png`, width);

			await page.goto(detailUrl());
			await page.getByTestId('rotate-password').click();
			await page.waitForTimeout(300);
			await page.screenshot({ path: `${dir}/rotate-dialog-${width}.png` });
			await page
				.getByRole('dialog', { name: 'Ganti password database?' })
				.getByRole('button', { name: 'Ganti password' })
				.click();
			await expect(page.getByTestId('rotation-completed')).toContainText('Password sudah diganti');
			await page.getByTestId('password-rotation').scrollIntoViewIfNeeded();
			await fullShot(page, `${dir}/rotation-completed-${width}.png`, width);

			await page.goto(`/projects/${PROJECT_ID}`);
			await settled(page);
			await fullShot(page, `${dir}/project-deploying-over-live-${width}.png`, width);
		});

		test(`states at ${width} px`, async ({ page }) => {
			const dir = SCREENSHOT_DIR!;
			await page.setViewportSize({ width, height: SCREENSHOT_HEIGHT });
			const locked = lockedDatabase();
			await mockDatabaseApi(page, {
				databases: [locked],
				role: 'member'
			});
			await page.goto(detailUrl(locked.id));
			await fullShot(page, `${dir}/detail-locked-member-${width}.png`, width);

			await page.unrouteAll({ behavior: 'ignoreErrors' });
			await mockDatabaseApi(page, { databases: [] });
			await page.goto(LIST_URL);
			await fullShot(page, `${dir}/empty-${width}.png`, width);

			await page.unrouteAll({ behavior: 'ignoreErrors' });
			await mockDatabaseApi(page, { databases: [], databasesAvailable: false });
			await page.goto(LIST_URL);
			await fullShot(page, `${dir}/unavailable-empty-${width}.png`, width);

			await page.unrouteAll({ behavior: 'ignoreErrors' });
			await mockDatabaseApi(page, { databasesAvailable: false });
			await page.goto(LIST_URL);
			await fullShot(page, `${dir}/unavailable-list-${width}.png`, width);
		});
	}
});

import { mkdir } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import {
	BUCKET_ID,
	KEY_ROTATION_DEPLOYMENT_ID,
	attachedProject,
	capturedBucket,
	mockBucketApi,
	projectBucket,
	provisioningBucket,
	readyBucket,
	spareBucket,
	unknownRotationBucket
} from './fixtures/buckets';
import { auditDom } from './fixtures/dom-audit';
import { PROJECT_ID } from './fixtures/project-detail';

const LIST_URL = '/buckets';
const detailUrl = (id = BUCKET_ID) => `/buckets/${id}`;

async function settled(page: Page) {
	await page.waitForLoadState('networkidle');
	await expect(page.locator('main')).toHaveCount(1);
}

const sidebarBucket = (page: Page) =>
	page.getByRole('link', { name: 'Bucket', exact: true }).first();

test.describe('where buckets appear', () => {
	test('a workspace opened for buckets gets the Bucket menu after Database', async ({ page }) => {
		await mockBucketApi(page);
		await page.goto(LIST_URL);
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bucket');
		await expect(sidebarBucket(page)).toHaveAttribute('aria-current', 'page');
	});

	test('an API without buckets shows no menu and no project offer', async ({ page }) => {
		await mockBucketApi(page, { buckets: [], bucketsAvailable: null });
		await page.goto(`/projects/${PROJECT_ID}/environments`);
		await settled(page);
		await expect(sidebarBucket(page)).toHaveCount(0);
		await expect(page.getByTestId('bucket-variables-offer')).toHaveCount(0);
	});

	test('a workspace with no bucket quota sees no menu, and a quiet note on the page', async ({
		page
	}) => {
		await mockBucketApi(page, { buckets: [], quota: { max_buckets: 0, max_bucket_storage_mb: 0 } });
		await page.goto(LIST_URL);
		await expect(page.getByTestId('buckets-closed')).toContainText(
			'Workspace ini belum bisa membuat bucket'
		);
		await expect(page.getByTestId('create-bucket')).toHaveCount(0);
		await expect(sidebarBucket(page)).toHaveCount(0);
	});

	test('an installation without a storage server says so, with no way to create one', async ({
		page
	}) => {
		await mockBucketApi(page, { buckets: [], bucketsAvailable: false });
		await page.goto(LIST_URL);
		await expect(
			page.getByRole('heading', { name: 'Bucket terkelola belum tersedia di server ini' })
		).toBeVisible();
		await expect(page.getByTestId('create-bucket')).toHaveCount(0);
	});
});

test.describe('bucket list', () => {
	test('lists each bucket with status, usage against its quota, projects, and the workspace allocation', async ({
		page
	}) => {
		await mockBucketApi(page, {
			buckets: [provisioningBucket(), readyBucket(), spareBucket()],
			quota: { max_buckets: 5, max_bucket_storage_mb: 1024 }
		});
		await page.goto(LIST_URL);
		const rows = page.getByTestId('bucket-row');
		await expect(rows).toHaveCount(3);
		await expect(rows.nth(0)).toContainText('Menyiapkan');
		await expect(rows.nth(1)).toContainText('unggahan-toko');
		await expect(rows.nth(1)).toContainText('36 MB dari 256 MB');
		await expect(rows.nth(1)).toContainText(attachedProject.name);
		await expect(rows.nth(2)).toContainText('hampir penuh');
		await expect(page.getByTestId('bucket-quota-count')).toHaveText('3 dari 5 bucket');
		await expect(page.getByTestId('bucket-quota-storage')).toContainText(
			'dialokasikan 612 MB dari 1 GB'
		);
		await expect(page.getByTestId('bucket-quota-storage')).toContainText('terpakai');
	});
});

test.describe('bucket journeys', () => {
	test('creates one with a quota and follows it until it is ready', async ({ page }) => {
		const { calls } = await mockBucketApi(page, { buckets: [], provisioningReads: 1 });
		await page.goto(LIST_URL);
		await page.getByTestId('create-bucket').first().click();
		const dialog = page.getByRole('dialog', { name: 'Buat bucket' });
		await expect(dialog.getByLabel('Kuota (MB)')).toHaveValue('256');
		await dialog.getByLabel('Nama bucket').fill('galeri');
		await dialog.getByLabel('Kuota (MB)').fill('128');
		await dialog.getByRole('button', { name: 'Buat bucket' }).click();

		await expect(page).toHaveURL(/\/buckets\/bucket-new-0\?workspace=/);
		expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
			name: 'galeri',
			region: null,
			quota_mb: 128
		});
		await expect(page.getByTestId('bucket-status-explanation')).toContainText(
			'Server penyimpanan sedang membuat bucket ini'
		);
		// The page polls every 5 s while the node creates it.
		await expect(page.getByTestId('bucket-status-explanation')).toContainText(
			'Menerima upload dan unduhan',
			{ timeout: 15_000 }
		);
	});

	test('from a project, creates a bucket attached to it in one step', async ({ page }) => {
		const { calls } = await mockBucketApi(page, {
			buckets: [],
			quota: { max_buckets: 3, max_bucket_storage_mb: 1024 }
		});
		await page.goto(`/projects/${PROJECT_ID}/environments`);
		await page.getByTestId('create-project-bucket').click();
		const dialog = page.getByRole('dialog', { name: 'Buat bucket untuk proyek ini' });
		await expect(dialog).toContainText(`langsung dipasang ke ${attachedProject.name}`);
		await dialog.getByRole('button', { name: 'Buat bucket' }).click();
		await expect(page).toHaveURL(/\/buckets\/bucket-new-0/);
		expect(calls.find((call) => call.method === 'POST')?.body).toMatchObject({
			name: null,
			project_id: PROJECT_ID
		});
	});

	test('attaches a project and asks for its redeploy', async ({ page }) => {
		await mockBucketApi(page);
		await page.goto(detailUrl('bucket-spare'));
		await page.getByTestId('attach-bucket').click();
		const dialog = page.getByRole('dialog', { name: 'Pasang ke proyek' });
		await dialog.getByText('api-kasir').click();
		await dialog.getByRole('button', { name: 'Pasang bucket' }).click();
		await expect(page.getByTestId('bucket-redeploy-notices')).toContainText(
			'Redeploy api-kasir supaya aplikasinya menerima variabel bucket ini.'
		);
		await expect(page.getByTestId('bucket-projects')).toContainText('api-kasir');
	});

	test('shows the secret to an owner only after Tampilkan, with the .env block, then hides it', async ({
		page
	}) => {
		const secret = capturedBucket<{ data: { secret_access_key: string } }>('credentials').body.data
			.secret_access_key;
		const { calls } = await mockBucketApi(page);
		await page.goto(detailUrl());
		await expect(page.getByTestId('bucket-connection')).not.toContainText(secret);
		expect(calls.some((call) => call.path.endsWith('/credentials'))).toBe(false);

		await page.getByTestId('reveal-bucket-credentials').click();
		await expect(page.getByTestId('bucket-connection')).toContainText(secret);
		await expect(page.getByTestId('bucket-env-block')).toContainText(
			'AWS_USE_PATH_STYLE_ENDPOINT=true'
		);
		await page.getByTestId('hide-bucket-credentials').click();
		await expect(page.getByTestId('bucket-connection')).not.toContainText(secret);
	});

	test('tells a member why the secret stays hidden, without asking the API', async ({ page }) => {
		const { calls } = await mockBucketApi(page, { role: 'member' });
		await page.goto(detailUrl());
		await expect(page.getByTestId('bucket-credentials-owner-only')).toBeVisible();
		await expect(page.getByTestId('reveal-bucket-credentials')).toHaveCount(0);
		expect(calls.some((call) => call.path.endsWith('/credentials'))).toBe(false);
	});

	test('rotates the key with redeploys and links the queued deployment', async ({ page }) => {
		const { calls } = await mockBucketApi(page);
		await page.goto(detailUrl());
		await page.getByTestId('rotate-bucket-key').click();
		const dialog = page.getByRole('dialog', { name: 'Ganti secret key bucket?' });
		await expect(dialog.getByRole('checkbox')).toBeChecked();
		await dialog.getByRole('button', { name: 'Ganti secret key' }).click();
		await expect(page.getByTestId('key-rotation-completed')).toContainText(
			'Secret key sudah diganti'
		);
		await expect(
			page.getByTestId(`rotation-project-${PROJECT_ID}`).getByRole('link', {
				name: /Lihat deployment/
			})
		).toHaveAttribute('href', `/projects/${PROJECT_ID}/deployments/${KEY_ROTATION_DEPLOYMENT_ID}`);
		expect(calls.find((call) => call.path.endsWith('/rotate-key'))?.body).toEqual({
			redeploy_attached: true
		});
	});

	test('explains an unknown rotation and lets the owner rotate again', async ({ page }) => {
		await mockBucketApi(page, { buckets: [unknownRotationBucket()] });
		await page.goto(detailUrl(unknownRotationBucket().id));
		await expect(page.getByTestId('key-rotation-unknown')).toContainText(
			'Ganti secret key sekali lagi'
		);
		await expect(page.getByTestId('reveal-bucket-credentials')).toBeDisabled();
		await expect(page.getByTestId('rotate-bucket-key')).toBeEnabled();
	});

	test('changes the quota and shows it landing', async ({ page }) => {
		const { calls } = await mockBucketApi(page);
		await page.goto(detailUrl());
		await page.getByRole('button', { name: 'Ubah kuota bucket' }).click();
		await page.getByLabel('Kuota (MB)').fill('512');
		await page.getByRole('button', { name: 'Simpan kuota' }).click();
		await expect(page.getByTestId('bucket-quota-value')).toContainText('512 MB');
		expect(calls.find((call) => call.method === 'PATCH')?.body).toEqual({ quota_mb: 512 });
	});

	test('blocks deleting while attached, then detaches and deletes with the name typed', async ({
		page
	}) => {
		await mockBucketApi(page);
		await page.goto(detailUrl());
		await expect(page.getByTestId('delete-bucket')).toBeDisabled();
		await page.getByRole('button', { name: `Lepas dari ${attachedProject.name}` }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Lepas bucket' }).click();
		await expect(page.getByTestId('delete-bucket')).toBeEnabled();
		await page.getByTestId('delete-bucket').click();
		const dialog = page.getByRole('dialog', { name: 'Hapus unggahan-toko?' });
		await dialog.getByLabel(/untuk konfirmasi/).fill('unggahan-toko');
		await dialog.getByRole('button', { name: 'Hapus bucket ini' }).click();
		await expect(page).toHaveURL(/\/buckets$/);
	});

	test('the variables tab lists the injected variables and offers FILESYSTEM_DISK to Laravel', async ({
		page
	}) => {
		await mockBucketApi(page, {
			project: {
				stack: {
					builder: 'railpack',
					provider: 'php',
					framework: 'laravel',
					package_manager: 'composer'
				}
			},
			envList: [
				{
					id: 1,
					key: 'AWS_DEFAULT_REGION',
					value: 'ap-southeast-3',
					is_secret: false,
					created_at: '2026-01-01T00:00:00Z'
				}
			]
		});
		await page.goto(`/projects/${PROJECT_ID}/environments`);
		await expect(page.getByTestId('bucket-variables')).toContainText('Dari bucket unggahan-toko');
		await expect(page.getByTestId('bucket-variable-AWS_DEFAULT_REGION')).toContainText(
			'Ditimpa proyek'
		);
		await expect(page.getByTestId('env-overrides-bucket')).toHaveText('Menimpa bucket');
		await expect(page.getByTestId('bucket-filesystem-disk-hint')).toContainText(
			'FILESYSTEM_DISK=s3'
		);
	});
});

test.describe('bucket pages meet the floor', () => {
	for (const width of [320, 1280] as const) {
		test(`list and detail at ${width} px`, async ({ page }) => {
			await page.setViewportSize({ width, height: 800 });
			await mockBucketApi(page, { buckets: [provisioningBucket(), readyBucket(), spareBucket()] });
			for (const path of [LIST_URL, detailUrl(), detailUrl('bucket-provisioning')]) {
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
		await mockBucketApi(page, { quota: { max_buckets: 5, max_bucket_storage_mb: 1024 } });
		await page.goto(LIST_URL);
		await settled(page);
		await page.getByTestId('create-bucket').focus();
		await page.keyboard.press('Enter');
		const dialog = page.getByRole('dialog', { name: 'Buat bucket' });
		await expect(dialog).toBeVisible();
		await expect(dialog.getByLabel('Nama bucket')).toBeFocused();
		await page.keyboard.press('Escape');
		await expect(dialog).toHaveCount(0);
		await expect(page.getByTestId('create-bucket')).toBeFocused();
	});
});

/**
 * Screenshots for the pull request, written only when BUCKET_SCREENSHOTS names a folder, so CI does
 * not spend time on them.
 */
const SCREENSHOT_DIR = process.env.BUCKET_SCREENSHOTS;
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
	test.skip(!SCREENSHOT_DIR, 'set BUCKET_SCREENSHOTS to write them');
	test.describe.configure({ timeout: 120_000 });

	for (const width of [1440, 390] as const) {
		test(`at ${width} px`, async ({ page }) => {
			const dir = SCREENSHOT_DIR!;
			await mkdir(dir, { recursive: true });
			await page.setViewportSize({ width, height: SCREENSHOT_HEIGHT });
			const shot = (name: string) => fullShot(page, `${dir}/${name}-${width}.png`, width);

			await mockBucketApi(page, {
				buckets: [provisioningBucket(), readyBucket(), spareBucket()],
				quota: { max_buckets: 5, max_bucket_storage_mb: 1024 },
				project: {
					stack: {
						builder: 'railpack',
						provider: 'php',
						framework: 'laravel',
						package_manager: 'composer'
					},
					buckets: [projectBucket()]
				},
				envList: [
					{
						id: 1,
						key: 'AWS_DEFAULT_REGION',
						value: 'ap-southeast-3',
						is_secret: false,
						created_at: '2026-01-01T00:00:00Z'
					}
				]
			});
			await page.goto(LIST_URL);
			await shot('list');

			await page.getByTestId('create-bucket').first().click();
			await page.getByRole('dialog').getByLabel('Nama bucket').fill('galeri');
			await page.waitForTimeout(300);
			await page.screenshot({ path: `${dir}/create-dialog-${width}.png` });
			await page.keyboard.press('Escape');

			await page.goto(detailUrl());
			await shot('detail');
			await page.getByTestId('reveal-bucket-credentials').click();
			await expect(page.getByTestId('bucket-env-block')).toBeVisible();
			await shot('detail-credentials-owner');

			await page.getByTestId('rotate-bucket-key').click();
			await page.waitForTimeout(300);
			await page.screenshot({ path: `${dir}/rotate-dialog-${width}.png` });
			await page
				.getByRole('dialog', { name: 'Ganti secret key bucket?' })
				.getByRole('button', { name: 'Ganti secret key' })
				.click();
			await expect(page.getByTestId('key-rotation-completed')).toBeVisible();
			await shot('rotation-completed');

			await page.goto(detailUrl('bucket-provisioning'));
			await shot('detail-provisioning');

			await page.goto(`/projects/${PROJECT_ID}/environments`);
			await shot('project-variables');
		});

		test(`states at ${width} px`, async ({ page }) => {
			const dir = SCREENSHOT_DIR!;
			await mkdir(dir, { recursive: true });
			await page.setViewportSize({ width, height: SCREENSHOT_HEIGHT });

			await mockBucketApi(page, { role: 'member' });
			await page.goto(detailUrl());
			await fullShot(page, `${dir}/detail-member-${width}.png`, width);

			await page.unrouteAll({ behavior: 'ignoreErrors' });
			await mockBucketApi(page, { buckets: [unknownRotationBucket()] });
			await page.goto(detailUrl(unknownRotationBucket().id));
			await fullShot(page, `${dir}/detail-rotation-unknown-${width}.png`, width);

			await page.unrouteAll({ behavior: 'ignoreErrors' });
			await mockBucketApi(page, { buckets: [] });
			await page.goto(LIST_URL);
			await fullShot(page, `${dir}/empty-${width}.png`, width);

			await page.unrouteAll({ behavior: 'ignoreErrors' });
			await mockBucketApi(page, {
				buckets: [],
				quota: { max_buckets: 0, max_bucket_storage_mb: 0 }
			});
			await page.goto(LIST_URL);
			await fullShot(page, `${dir}/no-quota-${width}.png`, width);

			await page.unrouteAll({ behavior: 'ignoreErrors' });
			await mockBucketApi(page, { buckets: [], bucketsAvailable: false });
			await page.goto(LIST_URL);
			await fullShot(page, `${dir}/unavailable-${width}.png`, width);

			await page.unrouteAll({ behavior: 'ignoreErrors' });
			await mockBucketApi(page, {
				buckets: [],
				quota: { max_buckets: 3, max_bucket_storage_mb: 1024 },
				project: { runtime_status: 'sleeping', status: 'live' }
			});
			await page.goto(`/projects/${PROJECT_ID}`);
			await fullShot(page, `${dir}/project-sleeping-offer-${width}.png`, width);
		});
	}
});

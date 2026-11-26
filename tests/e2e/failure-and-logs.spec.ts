import { expect, test, type Page } from '@playwright/test';
import { mockSignedOutRoutes } from './fixtures/all-routes';
import {
	baseProject,
	DETAIL_URL,
	failedDeployment,
	mockProjectApi,
	PROJECT_ID
} from './fixtures/project-detail';
import {
	failedEvents,
	failedLogLines,
	logReply,
	realisticFailed,
	realisticSucceeded,
	succeededEvents,
	succeededLogLines
} from './fixtures/realistic-logs';

const log = (page: Page) => page.getByRole('log');
const row = (page: Page, sequence: number) => log(page).locator(`[data-sequence="${sequence}"]`);

async function openSucceeded(page: Page) {
	const second = { ...realisticSucceeded, sequence: 2 };
	await mockProjectApi(page, {
		deployment: () => second,
		deploymentList: () => [second, { ...realisticSucceeded, id: 'a', sequence: 1 }],
		events: () => succeededEvents,
		logs: logReply(succeededLogLines)
	});
	await page.goto(DETAIL_URL);
	await expect(log(page).getByText('Server listening')).toBeVisible();
}

async function openFailed(page: Page, url = DETAIL_URL) {
	await mockProjectApi(page, {
		deployment: () => realisticFailed,
		deploymentList: () => [realisticFailed],
		events: () => failedEvents,
		logs: logReply(failedLogLines)
	});
	await page.goto(url);
	await expect(log(page).getByText('failed to solve')).toBeVisible();
}

test.describe('a successful deploy does not look failed', () => {
	test('stderr progress is neutral, no line is an error, the npm warning is labelled', async ({
		page
	}) => {
		await openSucceeded(page);

		expect(await log(page).locator('[data-stream="stderr"]').count()).toBeGreaterThan(10);
		await expect(log(page).locator('[data-level="error"]')).toHaveCount(0);
		const warning = log(page).locator('[data-level="warning"]');
		await expect(warning).toHaveCount(1);
		await expect(warning).toContainText('warn');

		// No red anywhere: stderr reads in the same colour as stdout.
		const colour = (sequence: number) =>
			row(page, sequence)
				.locator('span')
				.last()
				.evaluate((el) => getComputedStyle(el).color);
		expect(await colour(2)).toBe(await colour(3));
	});

	test('"Hanya error" says the deploy did not fail instead of listing stderr', async ({ page }) => {
		await openSucceeded(page);

		await page.getByRole('button', { name: 'Hanya error' }).click();

		await expect(page.getByText('Tidak ada baris error di log ini')).toBeVisible();
		await expect(page.getByText(/Baris stderr biasanya hanya laporan proses/)).toBeVisible();
	});
});

test.describe('a failed deploy points at its errors', () => {
	test('only the failing stage error lines are red, each with an icon and the word', async ({
		page
	}) => {
		await openFailed(page);

		const errors = log(page).locator('[data-level="error"]');
		await expect(errors).toHaveCount(4);
		await expect(errors.first()).toContainText('error during build:');
		await expect(errors.last()).toContainText('failed to solve');
		for (const index of [0, 1, 2, 3]) {
			await expect(errors.nth(index).locator('svg')).toHaveCount(1);
		}
		// Progress before the failure stays neutral, even on stderr.
		await expect(row(page, 2)).toHaveAttribute('data-level', 'normal');
		await expect(row(page, 9)).toHaveAttribute('data-level', 'warning');
	});

	test('"Hanya error" keeps exactly the red lines', async ({ page }) => {
		await openFailed(page);

		await page.getByRole('button', { name: 'Hanya error (4)' }).click();

		await expect(log(page).locator('[data-sequence]:not([hidden])')).toHaveCount(4);
		await expect(page.getByText('4 dari 20 baris')).toBeVisible();
	});

	test('"Lihat error di log" brings the first error line into view', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 600 });
		await openFailed(page);

		await page.getByRole('button', { name: 'Lihat error di log' }).click();

		await expect(log(page)).toBeFocused();
		await expect(log(page).locator('[data-level="error"]').first()).toBeInViewport();
	});

	test('"Salin ringkasan error" copies a masked summary with the stage stderr lines', async ({
		page,
		context
	}) => {
		await context.grantPermissions(['clipboard-read', 'clipboard-write']);
		await openFailed(page);

		await page.getByRole('button', { name: 'Salin ringkasan error' }).click();
		await expect(page.getByText(/Ringkasan error disalin/)).toBeVisible();

		const text = await page.evaluate(() => navigator.clipboard.readText());
		expect(text).toContain('Deployment #5 proyek toko-kopi-web gagal (branch main');
		expect(text).toContain('Tahap: Build proyek');
		expect(text).toContain('Kode: runtime_build_failed');
		expect(text).toContain('Ringkasan: Proses build aplikasi berhenti sebelum selesai.');
		expect(text).toContain('error during build:');
		expect(text).toContain('postgres://kopi:[disamarkan]@db.internal');
		expect(text).not.toContain('rahasia-sekali');
		// stdout lines and lines from before the failing stage stay out.
		expect(text).not.toContain('Railpack 0.9.2');
		expect(text).not.toContain('Cloning into');
		expect(text).toMatch(/Periksa dulu sebelum dibagikan/);
	});
});

test.describe('log tools', () => {
	test('a #L link scrolls to that line and highlights it', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 500 });
		await openFailed(page, `${DETAIL_URL}#L12`);

		await expect(row(page, 12)).toHaveAttribute('data-highlighted', '');
		await expect(row(page, 12)).toBeInViewport();
	});

	test('clicking a line number puts its permalink in the address', async ({ page }) => {
		await openFailed(page);

		await page.getByRole('link', { name: 'Tautan ke baris 7' }).click();

		await expect(page).toHaveURL(new RegExp(`${DETAIL_URL}#L7$`));
		await expect(row(page, 7)).toHaveAttribute('data-highlighted', '');
	});

	test('/ focuses the search, which filters lines without regard to case', async ({ page }) => {
		await openFailed(page);
		await page.locator('body').click({ position: { x: 5, y: 5 } });

		await page.keyboard.press('/');
		await expect(page.getByRole('searchbox', { name: 'Cari di log' })).toBeFocused();
		await page.keyboard.type('VITE');

		await expect(log(page).locator('[data-sequence]:not([hidden])')).toHaveCount(4);
		await expect(page.getByText('4 dari 20 baris')).toBeVisible();
	});

	test('Unduh .txt saves the loaded log under the project and deployment name', async ({
		page
	}) => {
		await openFailed(page);

		const [download] = await Promise.all([
			page.waitForEvent('download'),
			page.getByRole('button', { name: 'Unduh .txt' }).click()
		]);

		expect(download.suggestedFilename()).toBe('toko-kopi-web-deployment-5.txt');
		const stream = await download.createReadStream();
		const chunks: Buffer[] = [];
		for await (const chunk of stream) chunks.push(chunk as Buffer);
		const text = Buffer.concat(chunks).toString('utf8');
		expect(text.trim().split('\n')).toHaveLength(failedLogLines.length);
		expect(text).toContain('stderr ERROR: failed to solve');
	});

	test('the tools fit a 320 px screen without scrolling sideways', async ({ page }) => {
		await page.setViewportSize({ width: 320, height: 700 });
		await openFailed(page);

		await expect(page.getByRole('searchbox', { name: 'Cari di log' })).toBeVisible();
		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth > window.innerWidth
		);
		expect(overflow).toBe(false);
	});
});

test.describe('Metrik charts', () => {
	test('the large charts draw value labels, and the readout names its point', async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await mockProjectApi(page);
		await page.goto(`/projects/${PROJECT_ID}/monitoring?range=1h`);

		const memory = page.locator('.time-series-chart').first();
		await expect(memory.locator('canvas')).toBeVisible();
		// The value axis is as wide as its longest label; with no ticks it was only the tick (18 px).
		const yAxis = memory.locator('.u-axis').nth(1);
		const box = await yAxis.boundingBox();
		expect(box!.width).toBeGreaterThan(40);
		await expect(memory).toContainText(/Titik\s*:?\s*terbaru, /);
		await expect(memory).toContainText('Puncak');
		await expect(memory).not.toContainText('Tertinggi');
	});
});

test.describe('unsubscribing from an email link', () => {
	const QUERY = '?category=deployment_failure&user=7&signature=ab%2Fcd%3D';

	async function mockUnsubscribe(page: Page, status: number, body: unknown) {
		const requests: { url: string; cookie?: string; xsrf?: string }[] = [];
		await mockSignedOutRoutes(page);
		await page.route('**/api/v1/public/notifications/unsubscribe**', (route) => {
			const request = route.request();
			requests.push({
				url: request.url(),
				cookie: request.headers()['cookie'],
				xsrf: request.headers()['x-xsrf-token']
			});
			return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
		});
		return requests;
	}

	test('asks first, then posts the query exactly as received, without cookies', async ({
		page,
		context
	}) => {
		await context.addCookies([
			{ name: 'XSRF-TOKEN', value: 'should-not-travel', url: 'http://api.sakala.localhost:8000' }
		]);
		const requests = await mockUnsubscribe(page, 200, {
			data: { category: 'deployment_failure', email: false }
		});

		await page.goto(`/notifications/unsubscribe${QUERY}`);
		await expect(page.getByRole('heading', { name: 'Berhenti menerima email ini?' })).toBeVisible();
		await expect(page.getByText(/email "Deployment gagal"/)).toBeVisible();
		expect(requests).toHaveLength(0);

		await page.getByRole('button', { name: 'Ya, matikan email ini' }).click();

		await expect(page.getByRole('heading', { name: 'Email dimatikan' })).toBeVisible();
		expect(requests).toHaveLength(1);
		expect(new URL(requests[0].url).search).toBe(QUERY);
		expect(requests[0].cookie).toBeUndefined();
		expect(requests[0].xsrf).toBeUndefined();
	});

	for (const [status, heading] of [
		[403, 'Tautan ini tidak bisa dipakai'],
		[404, 'Akun ini sudah dihapus'],
		[422, 'Kategori ini tidak diatur lewat email'],
		[429, 'Terlalu banyak permintaan']
	] as const) {
		test(`a ${status} says what it means`, async ({ page }) => {
			await mockUnsubscribe(page, status, { message: 'x' });
			await page.goto(`/notifications/unsubscribe${QUERY}`);
			await page.getByRole('button', { name: 'Ya, matikan email ini' }).click();

			await expect(page.getByRole('heading', { name: heading })).toBeVisible();
		});
	}

	test('a link without its signature is refused without asking the API', async ({ page }) => {
		const requests = await mockUnsubscribe(page, 200, {});
		await page.goto('/notifications/unsubscribe?category=deployment_failure');

		await expect(
			page.getByRole('heading', { name: 'Tautan ini tidak bisa dipakai' })
		).toBeVisible();
		expect(requests).toHaveLength(0);
	});
});

test.describe('a deployment that stops at "Mengecek aplikasi"', () => {
	const healthCheckFailed = {
		...failedDeployment,
		failure_code: 'runtime_app_not_listening',
		failure_summary:
			'Aplikasi berjalan, tetapi tidak menerima koneksi di port yang ditentukan Sakala.',
		failure: {
			...failedDeployment.failure,
			code: 'runtime_app_not_listening',
			category: 'runtime',
			summary: 'Aplikasi berjalan, tetapi tidak menerima koneksi di port yang ditentukan Sakala.',
			stage: 'health_checking'
		}
	};
	const withEnvExample = {
		...baseProject,
		inspection: {
			repository_url: null,
			commit_sha: null,
			dockerfile_found: false,
			env_example_found: true,
			compose_found: false,
			manifests: ['package.json'],
			package_manager: 'npm',
			inspected_at: null,
			env_example: {
				file: '.env.example',
				entries: [
					{ key: 'PORT', example_value: '3000' },
					{ key: 'APP_KEY', example_value: null },
					{ key: 'JWT_SECRET', example_value: null }
				],
				truncated: false
			},
			database_hint: null
		}
	};

	test('names the .env.example variables not set yet, and links the code to the guide', async ({
		page
	}) => {
		await mockProjectApi(page, {
			project: () => withEnvExample,
			deployment: () => healthCheckFailed,
			deploymentList: () => [healthCheckFailed],
			envList: () => [
				{ id: 1, key: 'APP_KEY', is_secret: true, created_at: '2026-01-01T00:00:00Z' }
			]
		});
		await page.goto(DETAIL_URL);

		const note = page.getByTestId('missing-env-variables');
		await expect(note).toContainText('1 variabel yang belum ada di proyek ini: JWT_SECRET');
		await expect(note).not.toContainText('PORT');
		await expect(note.getByRole('link', { name: 'Isi di tab Variabel' })).toHaveAttribute(
			'href',
			`/projects/${PROJECT_ID}/environments#isi-dari-env-example`
		);
		await expect(page.getByRole('link', { name: /baca penjelasan kode ini/ })).toHaveAttribute(
			'href',
			'https://sakala.dev/docs/deploy-gagal#runtime_app_not_listening'
		);
	});

	test('a failure at another stage says nothing about variables', async ({ page }) => {
		await mockProjectApi(page, {
			project: () => withEnvExample,
			deployment: () => failedDeployment,
			deploymentList: () => [failedDeployment],
			envList: () => []
		});
		await page.goto(DETAIL_URL);

		await expect(page.getByRole('link', { name: /baca penjelasan kode ini/ })).toHaveAttribute(
			'href',
			'https://sakala.dev/docs/deploy-gagal#runtime_build_failed'
		);
		await expect(page.getByTestId('missing-env-variables')).toHaveCount(0);
	});
});

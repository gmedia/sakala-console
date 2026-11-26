import { expect, test, type Page } from '@playwright/test';
import {
	DEPLOYMENT_ID,
	mockProjectApi,
	PROJECT_ID,
	succeededDeployment
} from './fixtures/project-detail';

const HISTORY_URL = `/projects/${PROJECT_ID}/deployments`;
const OLDER_ID = '01a0cd92-b2e0-7327-97a1-d688062f30a1';

const newest = {
	...succeededDeployment,
	id: DEPLOYMENT_ID,
	sequence: 3,
	commit_message: 'feat(web): halaman menu baru',
	created_at: '2026-09-20T08:41:00Z'
};
const older = {
	...succeededDeployment,
	id: OLDER_ID,
	sequence: 2,
	commit_message: 'fix(web): harga di keranjang',
	created_at: '2026-09-19T10:00:00Z'
};

const skip = (overrides: Record<string, unknown> = {}) => ({
	delivery_id: '6f1c2a3e-58cc-4372-a567-0e02b2c3d479',
	reason: 'no_changes_in_root_directory',
	commit_sha: 'abcdef1234567890abcdef1234567890abcdef12',
	commit_message: 'feat(api): endpoint pesanan',
	branch: 'main',
	root_directory: 'apps/web',
	changed_path_count: 7,
	example_paths: [
		'apps/api/app/Http/Controllers/OrderController.php',
		'apps/api/routes/api.php',
		'apps/api/tests/OrderTest.php',
		'apps/landing/index.html',
		'apps/landing/style.css'
	],
	after_deployment_id: DEPLOYMENT_ID,
	created_at: '2026-09-20T09:05:00Z',
	...overrides
});

function page_(data: unknown[]) {
	return {
		body: {
			data,
			meta: {
				current_page: 1,
				from: data.length ? 1 : null,
				last_page: 1,
				per_page: 100,
				to: data.length || null,
				total: data.length
			}
		}
	};
}

async function openHistory(page: Page, skipped: unknown[], requests: URL[] = []) {
	await mockProjectApi(page, {
		deploymentList: () => [newest, older],
		skippedPushes: (url) => {
			requests.push(url);
			return page_(skipped);
		}
	});
	await page.goto(HISTORY_URL);
	await expect(page.getByText('feat(web): halaman menu baru')).toBeVisible();
}

for (const width of [1280, 320]) {
	test.describe(`at ${width} px`, () => {
		test.use({ viewport: { width, height: 900 } });

		test('a skipped push sits above the deployment it followed, quiet and explained', async ({
			page
		}) => {
			const requests: URL[] = [];
			await openHistory(
				page,
				[
					skip(),
					skip({
						delivery_id: '7f1c2a3e-58cc-4372-a567-0e02b2c3d479',
						after_deployment_id: OLDER_ID,
						commit_message: 'docs(landing): ubah judul',
						created_at: '2026-09-19T12:00:00Z'
					})
				],
				requests
			);

			// Asked once for everything since the oldest deployment on the page.
			await expect.poll(() => requests.length).toBeGreaterThan(0);
			expect(requests[0].searchParams.get('since')).toBe(older.created_at);
			expect(requests[0].searchParams.get('per_page')).toBe('100');

			const rows = page.locator('ul.divide-y > li');
			await expect(rows).toHaveCount(4);
			await expect(rows.nth(0)).toContainText('Tidak ada perubahan di apps/web');
			// The status reads beside the title where there is no status column, and in it where there is.
			await expect(
				rows.nth(0).getByText('Dilewati', { exact: false }).filter({ visible: true })
			).toHaveCount(1);
			await expect(rows.nth(0)).toContainText('feat(api): endpoint pesanan');
			await expect(rows.nth(0)).toContainText('abcdef1');
			await expect(rows.nth(1)).toContainText('feat(web): halaman menu baru');
			await expect(rows.nth(2)).toContainText('docs(landing): ubah judul');
			await expect(rows.nth(3)).toContainText('fix(web): harga di keranjang');

			// Not an error and not a deployment: no link, no red.
			const row = page.getByTestId('skipped-push-row').first();
			await expect(row.getByRole('link')).toHaveCount(0);
			await expect(row.locator('.text-error, .bg-error')).toHaveCount(0);

			// The explanation opens from the keyboard and closes back to its button.
			const why = row.getByRole('button', { name: 'Kenapa push ini dilewati?' });
			await why.focus();
			await page.keyboard.press('Enter');
			const detail = page.getByTestId('skipped-push-detail');
			await expect(detail).toBeVisible();
			await expect(detail).toContainText('hanya mengubah file milik proyek lain');
			await expect(detail).toContainText('perubahan di apps/web dan file bersama di root');
			await expect(detail.getByRole('link', { name: /Panduan monorepo/ })).toHaveAttribute(
				'href',
				/\/monorepo#push-di-monorepo$/
			);
			await expect(detail).toContainText('7 file berubah');
			await expect(detail).toContainText('apps/api/routes/api.php');
			await expect(detail).toContainText('dan 2 file lainnya');
			await page.keyboard.press('Escape');
			await expect(detail).toHaveCount(0);
			await expect(why).toBeFocused();

			const box = await why.boundingBox();
			expect(box?.width).toBeGreaterThanOrEqual(24);
			expect(box?.height).toBeGreaterThanOrEqual(24);
			expect(
				await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
			).toBe(false);
		});
	});
}

test('an API without skipped pushes leaves the history as it was', async ({ page }) => {
	await mockProjectApi(page, {
		deploymentList: () => [newest, older],
		skippedPushes: () => ({ status: 404, body: { message: 'Not Found' } })
	});
	await page.goto(HISTORY_URL);

	await expect(page.getByText('feat(web): halaman menu baru')).toBeVisible();
	await expect(page.getByText('fix(web): harga di keranjang')).toBeVisible();
	await expect(page.getByTestId('skipped-push-row')).toHaveCount(0);
	await expect(page.getByRole('alert')).toHaveCount(0);
});

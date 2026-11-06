import { expect, test, type Page } from '@playwright/test';
import {
	baseProject,
	DETAIL_URL,
	failedDeployment,
	logLine,
	logPage,
	mockProjectApi,
	platformFailureDeployment,
	queuedDeployment,
	runningDeployment,
	succeededDeployment
} from './fixtures/project-detail';

const lines = Array.from({ length: 60 }, (_, index) => logLine(index + 1, `baris ${index + 1}`));
const withLogs = { logs: () => ({ body: logPage([...lines].reverse()) }) };

async function terminalBox(page: Page) {
	const box = await page.getByRole('log').boundingBox();
	if (!box) throw new Error('the terminal is not on the page');
	return box;
}

test.describe('the terminal is the page', () => {
	for (const [name, deployment, minHeight] of [
		['running', runningDeployment, 480],
		['queued', queuedDeployment, 440],
		['failed', failedDeployment, 300],
		['succeeded', succeededDeployment, 300]
	] as const) {
		test(`at 1280x800 a ${name} deployment shows it beside the stages, down to the fold`, async ({
			page
		}) => {
			await page.setViewportSize({ width: 1280, height: 800 });
			await mockProjectApi(page, { deployment: () => deployment, ...withLogs });

			await page.goto(DETAIL_URL);
			await expect(page.getByRole('log')).toBeVisible();

			const terminal = await terminalBox(page);
			const aside = await page
				.getByRole('complementary', { name: 'Tahapan dan info' })
				.boundingBox();

			expect(terminal.height).toBeGreaterThanOrEqual(minHeight);
			expect(terminal.y + terminal.height).toBeLessThanOrEqual(800);
			// Nothing but the terminal below it, and no second scrollbar for the page.
			expect(800 - (terminal.y + terminal.height)).toBeLessThanOrEqual(32);
			expect(aside?.width).toBeCloseTo(260, -1);
			expect(terminal.x).toBeGreaterThan((aside?.x ?? 0) + (aside?.width ?? 0));
			expect(terminal.width).toBeGreaterThan(600);
		});
	}

	test('has two columns from 1024 px', async ({ page }) => {
		await page.setViewportSize({ width: 1024, height: 768 });
		await mockProjectApi(page, withLogs);

		await page.goto(DETAIL_URL);
		const aside = await page.getByRole('complementary', { name: 'Tahapan dan info' }).boundingBox();
		const terminal = await terminalBox(page);

		expect(terminal.x).toBeGreaterThan((aside?.x ?? 0) + (aside?.width ?? 0) - 1);
		await expect(page.getByRole('button', { name: /^Tahapan/ })).toBeHidden();
	});

	for (const width of [320, 768]) {
		test(`stacks at ${width} px, with the log before the folded details`, async ({ page }) => {
			await page.setViewportSize({ width, height: 700 });
			await mockProjectApi(page, withLogs);

			await page.goto(DETAIL_URL);
			const toggle = page.getByRole('button', { name: 'Tahapan: Build proyek' });
			await expect(toggle).toHaveAttribute('aria-expanded', 'false');
			await expect(page.getByTestId('deployment-info')).toBeHidden();
			await expect(page.getByRole('log')).toBeVisible();

			await toggle.click();
			await expect(toggle).toHaveAttribute('aria-expanded', 'true');
			await expect(page.getByTestId('deployment-info')).toBeVisible();
		});
	}

	test('follows new lines, can be paused, and copies what it shows', async ({ page }) => {
		await mockProjectApi(page, withLogs);
		await page.goto(DETAIL_URL);

		await expect(page.getByText('baris 60')).toBeInViewport();
		await expect(page.getByTestId('log-cursor')).toBeVisible();

		await page.getByRole('button', { name: 'Jeda' }).click();
		await expect(page.getByRole('button', { name: 'Ikuti log' })).toBeVisible();
		await expect(page.getByTestId('log-cursor')).toBeHidden();
		await expect(page.getByRole('button', { name: 'Salin log' })).toBeVisible();
	});

	test('hides the clock on a phone, and keeps the stream readable without it', async ({ page }) => {
		await page.setViewportSize({ width: 320, height: 700 });
		await mockProjectApi(page, {
			deployment: () => failedDeployment,
			logs: () => ({ body: logPage([logLine(2, 'npm ERR!', 'stderr'), logLine(1, 'mulai')]) })
		});
		await page.goto(DETAIL_URL);

		const error = page.locator('[data-stream="stderr"]');
		await expect(error).toContainText('npm ERR!');
		await expect(error).toContainText('stderr');
		await expect(error.getByText(/^\d{2}:\d{2}:\d{2}$/)).toBeHidden();
	});
});

test.describe('what the page says about a deployment', () => {
	test('names the commit, and links its SHA to GitHub', async ({ page }) => {
		await mockProjectApi(page, { deployment: () => runningDeployment });
		await page.goto(DETAIL_URL);

		await expect(page.getByTestId('deployment-commit-message')).toHaveText('feat: something');
		await expect(page.getByTestId('deployment-commit').getByRole('link')).toHaveAttribute(
			'href',
			`${baseProject.repository_url}/commit/a3f2c9d`
		);
	});

	test('gives no time estimate or percentage while it runs', async ({ page }) => {
		await mockProjectApi(page, { deployment: () => runningDeployment, ...withLogs });
		await page.goto(DETAIL_URL);

		await expect(page.getByRole('heading', { name: 'Deployment sedang berjalan' })).toBeVisible();
		const text = await page.locator('main').innerText();
		expect(text.replace(/baris \d+/g, '')).not.toMatch(/\d+\s*%|perkiraan|estimasi|sisa waktu/i);
		await expect(page.getByRole('progressbar')).toHaveCount(0);
	});

	test('explains a queue with no server, and still offers to cancel', async ({ page }) => {
		await mockProjectApi(page, { deployment: () => queuedDeployment });
		await page.goto(DETAIL_URL);

		await expect(page.getByText(/Belum ada server Sakala yang siap/)).toBeVisible();
		await expect(page.getByRole('button', { name: 'Batalkan deployment' })).toBeVisible();
		await expect(page.getByText('Belum ada log')).toBeVisible();
	});

	test('does not put a platform failure on the code', async ({ page }) => {
		await mockProjectApi(page, { deployment: () => platformFailureDeployment });
		await page.goto(DETAIL_URL);

		await expect(page.getByText(/bukan dari kode kamu/).first()).toBeVisible();
		await expect(page.getByRole('button', { name: 'Redeploy' })).toBeVisible();
	});

	test('a succeeded deployment whose app keeps crashing is not called a success', async ({
		page
	}) => {
		await mockProjectApi(page, {
			deployment: () => succeededDeployment,
			project: () => ({ ...baseProject, runtime_status: 'crashed' })
		});
		await page.goto(DETAIL_URL);

		await expect(page.getByRole('heading', { name: /tapi aplikasinya terus crash/ })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Lihat status proyek' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Kunjungi situs' })).toHaveCount(0);
	});
});

test.describe('the first time a project goes live', () => {
	const first = { ...succeededDeployment, sequence: 1 };
	const url = baseProject.public_url;

	test('says so, with the address and open and copy beside it', async ({ page }) => {
		await mockProjectApi(page, { deployment: () => first, deploymentList: () => [first] });
		await page.goto(DETAIL_URL);

		await expect(
			page.getByRole('heading', { name: `${baseProject.name} sudah live` })
		).toBeVisible();
		await expect(
			page.getByTestId('first-live').getByRole('link', { name: 'Buka situs' })
		).toHaveAttribute('href', url);
		await expect(page.getByRole('button', { name: 'Salin URL' })).toBeVisible();
		await expect(page.getByRole('log')).toBeVisible();
	});

	test('earlier failures do not take the moment away', async ({ page }) => {
		const third = { ...succeededDeployment, sequence: 3 };
		await mockProjectApi(page, {
			deployment: () => third,
			deploymentList: () => [
				third,
				{ ...failedDeployment, id: 'b', sequence: 2 },
				{ ...failedDeployment, id: 'a', sequence: 1 }
			]
		});
		await page.goto(DETAIL_URL);

		await expect(page.getByTestId('first-live')).toBeVisible();
	});

	test('a later deployment stays calm', async ({ page }) => {
		const later = { ...succeededDeployment, sequence: 2 };
		await mockProjectApi(page, {
			deployment: () => later,
			deploymentList: () => [later, { ...succeededDeployment, id: 'a', sequence: 1 }]
		});
		await page.goto(DETAIL_URL);

		await expect(page.getByRole('heading', { name: 'Deployment berhasil' })).toBeVisible();
		await expect(page.getByTestId('first-live')).toHaveCount(0);
		await expect(page.getByRole('link', { name: 'Kunjungi situs' })).toBeVisible();
	});
});

import { expect, test } from '@playwright/test';
import { auditDom } from './fixtures/dom-audit';
import { mockProjectApi, PROJECT_ID } from './fixtures/project-detail';
import {
	capturedWorkload,
	laravelProject,
	mockViewerWorkspaces,
	mockWorkloadApi,
	screenshot,
	scrollsSideways,
	SETTINGS_URL,
	viewerProject,
	workloadState,
	type WorkloadState
} from './fixtures/workloads';

const NARROW = { width: 320, height: 800 };

async function open(page: import('@playwright/test').Page, state: WorkloadState = workloadState()) {
	await mockProjectApi(page, { project: () => laravelProject });
	await mockWorkloadApi(page, state);
	return state;
}

const scheduleUrl = (state: WorkloadState, index = 0) =>
	`/projects/${PROJECT_ID}/settings/schedules/${state.schedules[index].id}`;

test.describe('schedules (ADR-022)', () => {
	test('lists the schedules with their state, next run in WIB, and the workspace quota', async ({
		page
	}) => {
		await open(page);
		await page.goto(`${SETTINGS_URL}#jadwal`);

		const section = page.getByTestId('schedules-section');
		const rows = section.getByTestId('schedule-row');
		await expect(rows).toHaveCount(2);
		await expect(rows.nth(0)).toContainText('Laporan harian');
		await expect(rows.nth(0)).toContainText('Gagal 1 kali berturut-turut');
		await expect(rows.nth(0)).toContainText('Pada 02.30 WIB');
		await expect(rows.nth(0)).toContainText(/Run berikutnya:.*WIB/);
		await expect(rows.nth(1)).toContainText('Bersihkan sesi');
		await expect(rows.nth(1)).toContainText('Aktif');
		await expect(section.getByTestId('schedule-quota')).toHaveText(
			'0 dari 2 jadwal aktif di workspace ini terpakai. Jarak antar-run paling dekat 15 menit.'
		);
		await expect(section.getByTestId('schedule-suggestion')).toContainText(
			'php artisan schedule:run'
		);
		await screenshot(page, 'schedules-list');
	});

	test('creates a schedule from a preset with the next runs previewed in WIB', async ({ page }) => {
		const state = await open(page);
		await page.goto(SETTINGS_URL);
		await page.getByTestId('schedules-section').getByRole('link', { name: 'Buat jadwal' }).click();

		await expect(page.getByRole('heading', { name: 'Buat jadwal' })).toBeVisible();
		const form = page.getByTestId('schedule-form');
		await form.getByLabel('Nama').fill('Laporan harian');
		await form.getByLabel('Perintah').fill('php artisan report:daily');
		// The radios sit inside their pill-shaped labels, which is what people click.
		await form.getByText('Setiap 15 menit', { exact: true }).click();
		await expect(form.getByRole('radio', { name: 'Setiap 15 menit' })).toBeChecked();
		const preview = page.getByTestId('schedule-preview');
		await expect(preview).toContainText('Setiap 15 menit WIB');
		await expect(preview.getByRole('listitem')).toHaveCount(3);
		await expect(preview.getByRole('listitem').first()).toContainText(/WIB$/);

		// Too frequent for the workspace: said in the preview before anything is sent.
		await form.getByLabel('Ekspresi cron').fill('*/5 * * * *');
		await expect(preview).toContainText('paling sering berjalan setiap 15 menit');
		await expect(form.getByRole('radio', { name: 'Kustom' })).toBeChecked();
		await form.getByLabel('Ekspresi cron').fill('30 2 * * *');
		await expect(preview).toContainText('Pada 02.30 WIB');
		await screenshot(page, 'schedule-create-preview');

		await form.getByRole('button', { name: 'Simpan jadwal' }).click();
		await expect(page).toHaveURL(/\/settings\/schedules\/sc-3$/);
		expect(state.requests.find((request) => request.method === 'POST')?.body).toEqual({
			name: 'Laporan harian',
			command: 'php artisan report:daily',
			cron_expression: '30 2 * * *',
			timezone: 'Asia/Jakarta',
			timeout_seconds: 300,
			enabled: true
		});
		await expect(page.getByTestId('schedule-detail')).toContainText('Laporan harian');
	});

	test('shows the run history in WIB, with a failed and a missed run, and opens a run log', async ({
		page
	}) => {
		const state = await open(page);
		await page.goto(scheduleUrl(state));

		const history = page.getByTestId('schedule-run-history');
		const runs = history.getByTestId('schedule-run');
		await expect(runs).toHaveCount(10);
		const failed = history.locator('[data-testid="schedule-run"][data-status="failed"]').first();
		await expect(failed).toContainText('Gagal');
		await expect(failed).toContainText(/Dijadwalkan .* WIB/);
		await expect(failed).toContainText(/Kode keluar\s*1/);
		await expect(failed).toContainText(/Durasi\s*5 detik/);
		await expect(failed).toContainText('buka log run untuk melihat error-nya');
		const missed = history.locator('[data-testid="schedule-run"][data-status="missed"]').first();
		await expect(missed).toContainText('Terlewat');
		await expect(missed).toContainText('penjadwal Sakala tidak sempat memulainya');
		await screenshot(page, 'schedule-run-history');

		await failed.getByRole('button', { name: 'Lihat log' }).click();
		await expect(page).toHaveURL(/\?run=/);
		await expect(failed.getByRole('log')).toContainText(
			'SQLSTATE[HY000] [2002] Connection refused'
		);
		await screenshot(page, 'schedule-run-log');

		// A missed run never started, so there is no log to offer.
		await expect(missed.getByRole('button', { name: 'Lihat log' })).toHaveCount(0);
	});

	test('runs now, stops the run, and explains a refused run by its reason', async ({ page }) => {
		const state = await open(page);
		await page.goto(scheduleUrl(state));

		await page.getByRole('button', { name: 'Jalankan sekarang' }).click();
		await expect(page.getByText('Run dimulai. Statusnya diperbarui di riwayat.')).toBeVisible();
		const queued = page.locator('[data-testid="schedule-run"][data-status="queued"]');
		await expect(queued).toContainText('Dijalankan manual');
		await queued.getByRole('button', { name: 'Hentikan run' }).click();
		await expect(
			page.locator('[data-testid="schedule-run"][data-status="cancelled"]').first()
		).toContainText('Dihentikan');

		state.runNow = capturedWorkload('run-now-overlap');
		await page.getByRole('button', { name: 'Jalankan sekarang' }).click();
		await expect(page.getByTestId('run-now-refused')).toContainText(
			'Jadwal ini masih punya run yang berjalan atau menunggu.'
		);

		state.runNow = capturedWorkload('run-now-no-live');
		await page.getByRole('button', { name: 'Jalankan sekarang' }).click();
		const refused = page.getByTestId('run-now-refused');
		await expect(refused).toContainText('belum punya deployment yang live');
		await expect(refused.getByRole('link', { name: 'Buka Riwayat deployment' })).toBeVisible();
	});

	test('a schedule Sakala paused after ten failures says why and resumes', async ({ page }) => {
		const state = workloadState();
		state.schedules[0] = capturedWorkload<{ data: Record<string, unknown> }>(
			'schedule-paused'
		).body.data;
		await open(page, state);
		await page.goto(scheduleUrl(state));

		const paused = page.getByTestId('schedule-paused');
		await expect(page.getByTestId('schedule-detail')).toContainText('Dijeda otomatis');
		await expect(paused).toContainText('setelah 10 run gagal berturut-turut');
		await screenshot(page, 'schedule-paused');
		await paused.getByRole('button', { name: 'Aktifkan lagi' }).click();
		await expect(page.getByTestId('schedule-detail')).toContainText('Aktif');
		await expect(paused).toBeHidden();
		expect(state.requests.find((request) => request.method === 'PATCH')?.body).toEqual({
			enabled: true
		});
	});

	test('a viewer reads schedules and history without any control', async ({ page }) => {
		const state = workloadState();
		await mockProjectApi(page, { project: () => viewerProject });
		await mockViewerWorkspaces(page);
		await mockWorkloadApi(page, state);

		await page.goto(SETTINGS_URL);
		await expect(page.getByTestId('schedule-row')).toHaveCount(2);
		await expect(page.getByRole('link', { name: 'Buat jadwal' })).toHaveCount(0);

		await page.goto(scheduleUrl(state));
		await expect(page.getByTestId('schedule-run')).toHaveCount(10);
		await expect(page.getByRole('button', { name: 'Jalankan sekarang' })).toHaveCount(0);
		await expect(page.getByRole('link', { name: 'Ubah' })).toHaveCount(0);
		await expect(page.getByTestId('schedule-detail')).toContainText(
			'Jadwal hanya bisa diubah pemilik dan anggota workspace.'
		);
	});

	test('fits 320 px without scrolling sideways', async ({ page }) => {
		await page.setViewportSize(NARROW);
		const state = await open(page);

		await page.goto(`${SETTINGS_URL}#jadwal`);
		await expect(page.getByTestId('schedule-row')).toHaveCount(2);
		expect(await scrollsSideways(page)).toBe(false);
		await screenshot(page, 'schedules-list-320');

		await page.goto(`/projects/${PROJECT_ID}/settings/schedules/new`);
		await expect(page.getByTestId('schedule-preview').getByRole('listitem')).toHaveCount(3);
		expect(await scrollsSideways(page)).toBe(false);
		await screenshot(page, 'schedule-create-320');

		await page.goto(scheduleUrl(state));
		await expect(page.getByTestId('schedule-run')).toHaveCount(10);
		expect(await scrollsSideways(page)).toBe(false);
		await screenshot(page, 'schedule-history-320');
	});

	for (const width of [320, 1280]) {
		test(`settings, a new schedule, and a run log pass the DOM audit at ${width} px`, async ({
			page
		}) => {
			await page.setViewportSize({ width, height: 800 });
			const state = await open(page);
			const failedRun = state.runs.find((run) => run.status === 'failed')!;
			// Each page is ready when its own content is: the settings page also asks GitHub for
			// branches, which this mock leaves unanswered, so the network never goes idle.
			const pages = [
				[SETTINGS_URL, page.getByTestId('schedule-row').first()],
				[
					`/projects/${PROJECT_ID}/settings/schedules/new`,
					page.getByTestId('schedule-preview').getByRole('listitem').first()
				],
				[`${scheduleUrl(state)}?run=${failedRun.id}`, page.getByRole('log')]
			] as const;
			for (const [path, ready] of pages) {
				await page.goto(path);
				await expect(ready).toBeVisible();
				await expect(page.locator('main')).toHaveCount(1);
				const audit = await auditDom(page, 24, width < 768 ? 44 : 24);
				const at = `${path} at ${width} px`;
				expect.soft(audit.overflow, `${at}: nothing past the viewport`).toEqual([]);
				expect.soft(audit.contrast, `${at}: text contrast`).toEqual([]);
				expect.soft(audit.controls, `${at}: edge of inputs`).toEqual([]);
				expect.soft(audit.targets, `${at}: targets of at least 24 px`).toEqual([]);
				expect.soft(audit.primaryTargets, `${at}: primary actions on touch`).toEqual([]);
				expect.soft(audit.h1, `${at}: exactly one h1`).toBe(1);
				expect.soft(audit.title, `${at}: a title of its own`).toMatch(/· Sakala$/);
			}
		});
	}
});

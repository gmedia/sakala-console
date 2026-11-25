import { expect, test } from '@playwright/test';
import {
	baseProject,
	DETAIL_URL,
	logLine,
	logPage,
	mockProjectApi,
	succeededDeployment
} from './fixtures/project-detail';
import {
	laravelProject,
	mixedProcessLogs,
	mockViewerWorkspaces,
	mockWorkloadApi,
	screenshot,
	scrollsSideways,
	PROCESSES_URL,
	SETTINGS_URL,
	viewerProject,
	workloadState
} from './fixtures/workloads';

const NARROW = { width: 320, height: 800 };

test.describe('worker processes (ADR-022)', () => {
	test('with the flags off, settings and logs show nothing new and never ask for workers', async ({
		page
	}) => {
		const state = workloadState();
		// An API with the flags off sends no process on any line.
		await mockProjectApi(page, {
			project: () => laravelProject,
			deployment: () => succeededDeployment,
			logs: () => ({ body: logPage([logLine(1, 'Server listening on port 8000')]) })
		});
		await mockWorkloadApi(page, state, { workers: false, schedules: false });

		await page.goto(SETTINGS_URL);
		await expect(page.getByRole('heading', { name: 'Umum' })).toBeVisible();
		const sections = page.getByRole('navigation', { name: 'Bagian pengaturan' });
		await expect(sections.getByRole('link')).toHaveText([
			'Umum',
			'Build dan start',
			'Zona berbahaya'
		]);
		await expect(page.getByTestId('processes-section')).toHaveCount(0);
		await expect(page.getByTestId('schedules-section')).toHaveCount(0);
		await screenshot(page, 'flag-off-settings');

		await page.goto(DETAIL_URL);
		await expect(page.getByText('Server listening on port 8000')).toBeVisible();
		await expect(page.getByRole('combobox', { name: 'Proses' })).toHaveCount(0);
		expect(state.requests).toEqual([]);
	});

	test('lists web and the workers, with a crash and how to read it', async ({ page }) => {
		await mockProjectApi(page, { project: () => laravelProject });
		await mockWorkloadApi(page, workloadState());

		await page.goto(`${SETTINGS_URL}#proses`);
		const section = page.getByTestId('processes-section');
		await expect(section.getByRole('heading', { name: 'Proses' })).toBeVisible();
		await expect(section.getByTestId('process-web')).toContainText('Melayani alamat');
		const rows = section.getByTestId('process-row');
		await expect(rows).toHaveCount(2);
		await expect(rows.nth(0)).toContainText('mailer');
		await expect(rows.nth(0)).toContainText('Tidak dijalankan');
		await expect(rows.nth(1)).toContainText('Crash');
		await expect(rows.nth(1).getByTestId('process-crash')).toContainText(
			'Keluar dengan kode 1, restart 4 kali, sejak Sel, 24 Nov 2026, 17.01 WIB'
		);
		await expect(rows.nth(1).getByRole('link', { name: 'Lihat log queue' })).toHaveAttribute(
			'href',
			/\/deployments\/.+\?process=queue#deployment-logs$/
		);
		await expect(section.getByTestId('worker-quota')).toContainText(
			'bisa menjalankan 2 container worker sekaligus'
		);
		await expect(section.getByTestId('worker-quota')).toContainText('slot container berjalan');
		await screenshot(page, 'processes-list');
	});

	test('adds the Laravel queue worker from the suggestion and says it runs from the next deploy', async ({
		page
	}) => {
		const state = { ...workloadState(), processes: [] };
		await mockProjectApi(page, { project: () => laravelProject });
		await mockWorkloadApi(page, state);

		await page.goto(PROCESSES_URL);
		const section = page.getByTestId('processes-section');
		await expect(section.getByText('Belum ada worker')).toBeVisible();
		await section.getByRole('button', { name: 'Pakai saran ini' }).click();

		const dialog = page.getByRole('dialog', { name: 'Tambah worker' });
		await expect(dialog.getByLabel('Nama')).toHaveValue('queue');
		await expect(dialog.getByLabel('Perintah')).toHaveValue(
			'php artisan queue:work --sleep=3 --tries=3 --max-time=3600'
		);
		await screenshot(page, 'processes-form');

		// Keyboard only: the name is reserved, then fixed, then saved with Enter.
		await dialog.getByLabel('Nama').fill('web');
		await dialog.getByLabel('Nama').press('Enter');
		await expect(dialog.getByText(/Nama web, release, dan job dipakai Sakala/)).toBeVisible();
		await dialog.getByLabel('Nama').fill('queue');
		await dialog.getByLabel('Nama').press('Enter');

		await expect(dialog).toBeHidden();
		expect(state.requests.find((request) => request.method === 'POST')?.body).toEqual({
			name: 'queue',
			command: 'php artisan queue:work --sleep=3 --tries=3 --max-time=3600',
			replicas: 1,
			memory_mb: null,
			cpu_millis: null
		});
		await expect(section.getByTestId('process-row')).toContainText(['queue']);
		await expect(section.getByRole('status')).toContainText(
			'Worker queue tersimpan. Berlaku mulai deployment berikutnya.'
		);
	});

	test('a viewer reads the workers without any control', async ({ page }) => {
		await mockProjectApi(page, { project: () => viewerProject });
		await mockViewerWorkspaces(page);
		await mockWorkloadApi(page, workloadState());

		await page.goto(PROCESSES_URL);
		const section = page.getByTestId('processes-section');
		await expect(section.getByTestId('process-row')).toHaveCount(2);
		await expect(section.getByRole('button')).toHaveCount(0);
		await expect(section).toContainText('Worker hanya bisa diubah pemilik dan anggota workspace.');
	});

	test('the live log filters by process and leaves scheduled output to the run history', async ({
		page
	}) => {
		await mockProjectApi(page, {
			project: () => laravelProject,
			deployment: () => succeededDeployment,
			logs: () => ({ body: mixedProcessLogs() })
		});
		await mockWorkloadApi(page, workloadState());

		await page.goto(DETAIL_URL);
		const log = page.getByRole('log');
		await expect(log.getByText('Processing: App\\Jobs\\SendInvoice')).toBeVisible();
		await expect(log.getByTestId('log-line-process').first()).toHaveText('[queue]');
		// The scheduled run's line is loaded but not shown here.
		await expect(log.getByText('Report written', { exact: false })).toBeHidden();
		const note = page.getByTestId('log-job-output-note');
		await expect(note).toContainText('1 baris output jadwal tidak ditampilkan di sini.');
		await expect(note.getByRole('link', { name: 'Lihat di riwayat run jadwal' })).toHaveAttribute(
			'href',
			/\/settings\/schedules$/
		);

		const filter = page.getByRole('combobox', { name: 'Proses' });
		await expect(filter.locator('option')).toHaveText(['Semua proses', 'web', 'queue']);
		await filter.selectOption('queue');
		await expect(log.getByText('Server listening on port 8000')).toBeHidden();
		await expect(log.getByText('Failed: App\\Jobs\\SendInvoice')).toBeVisible();
		await expect(page.getByText('2 dari 4 baris')).toBeVisible();
		await screenshot(page, 'log-process-filter');

		await filter.selectOption('web');
		await expect(log.getByText('Server listening on port 8000')).toBeVisible();
		await expect(log.getByText('Failed: App\\Jobs\\SendInvoice')).toBeHidden();
	});

	test('a crashing worker links to its own lines in the live log', async ({ page }) => {
		await mockProjectApi(page, {
			project: () => laravelProject,
			deployment: () => succeededDeployment,
			logs: () => ({ body: mixedProcessLogs() })
		});
		await mockWorkloadApi(page, workloadState());

		await page.goto(PROCESSES_URL);
		await page.getByRole('link', { name: 'Lihat log queue' }).click();
		await expect(page).toHaveURL(/\?process=queue#deployment-logs$/);
		await expect(page.getByRole('combobox', { name: 'Proses' })).toHaveValue('queue');
		await expect(page.getByRole('log').getByText('Server listening on port 8000')).toBeHidden();
	});

	test('fits 320 px without scrolling sideways', async ({ page }) => {
		await page.setViewportSize(NARROW);
		await mockProjectApi(page, { project: () => ({ ...baseProject, ...laravelProject }) });
		await mockWorkloadApi(page, workloadState());

		await page.goto(`${SETTINGS_URL}#proses`);
		await expect(page.getByTestId('process-row')).toHaveCount(2);
		expect(await scrollsSideways(page)).toBe(false);
		await screenshot(page, 'processes-320');

		await page.getByRole('button', { name: 'Ubah worker queue' }).click();
		await expect(page.getByRole('dialog', { name: 'Ubah worker queue' })).toBeVisible();
		expect(await scrollsSideways(page)).toBe(false);
		await screenshot(page, 'processes-form-320');
	});
});

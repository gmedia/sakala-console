import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import '../../../../app.css';
import DeploymentStatusBanner from './DeploymentStatusBanner.svelte';

const live = {
	status: 'success' as const,
	durationLabel: '1 menit 52 detik',
	servingState: 'live' as const,
	publicUrl: 'https://toko-kopi-web.sakala.app'
};

describe('the moment a project first goes live', () => {
	it('names the project, gives the address, and keeps open and copy together', async () => {
		await render(DeploymentStatusBanner, { ...live, firstLiveProjectName: 'toko-kopi-web' });

		await expect
			.element(page.getByRole('heading', { name: 'toko-kopi-web sudah live' }))
			.toBeVisible();
		await expect
			.element(page.getByRole('link', { name: 'toko-kopi-web.sakala.app' }))
			.toHaveAttribute('href', live.publicUrl);
		await expect.element(page.getByRole('link', { name: 'Buka situs' })).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Salin URL' })).toBeVisible();
	});

	it('copies the whole address', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
		await render(DeploymentStatusBanner, { ...live, firstLiveProjectName: 'toko-kopi-web' });

		await page.getByRole('button', { name: 'Salin URL' }).click();

		expect(writeText).toHaveBeenCalledWith(live.publicUrl);
	});

	it('stays calm for a later deployment', async () => {
		await render(DeploymentStatusBanner, { ...live, firstLiveProjectName: null });

		await expect.element(page.getByRole('heading', { name: 'Deployment berhasil' })).toBeVisible();
		await expect.element(page.getByTestId('first-live')).not.toBeInTheDocument();
	});

	it.each(['crash_looping', 'not_serving', 'superseded', 'unconfirmed'] as const)(
		'claims nothing when the app is %s',
		async (servingState) => {
			await render(DeploymentStatusBanner, {
				...live,
				servingState,
				firstLiveProjectName: 'toko-kopi-web'
			});

			await expect.element(page.getByTestId('first-live')).not.toBeInTheDocument();
			await expect
				.element(page.getByRole('link', { name: 'Kunjungi situs' }))
				.not.toBeInTheDocument();
		}
	);

	it('falls back when there is no address to show', async () => {
		await render(DeploymentStatusBanner, {
			...live,
			publicUrl: null,
			firstLiveProjectName: 'toko-kopi-web'
		});

		await expect.element(page.getByTestId('first-live')).not.toBeInTheDocument();
		await expect.element(page.getByText('URL publik proyek ini belum tersedia.')).toBeVisible();
	});
});

describe('a failed deployment', () => {
	const failed = {
		status: 'failed' as const,
		failureCategory: 'build',
		failureCode: 'runtime_build_failed',
		failureSummary: 'Proses build aplikasi berhenti sebelum selesai.',
		failureDetail: 'npm ERR! code ELIFECYCLE',
		recoveryHint: 'Perbaiki di repository, lalu deploy ulang.',
		userFixable: true
	};

	it('keeps category, summary, fix, detail, and code on screen', async () => {
		await render(DeploymentStatusBanner, { ...failed, onRedeploy: vi.fn(), onViewError: vi.fn() });

		await expect
			.element(page.getByRole('heading', { name: 'Deployment gagal saat build' }))
			.toBeVisible();
		await expect.element(page.getByText(failed.failureSummary)).toBeVisible();
		await expect.element(page.getByText('Cara memperbaiki:')).toBeVisible();
		await expect.element(page.getByText(failed.failureDetail)).toBeVisible();
		await expect.element(page.getByText(failed.failureCode)).toBeVisible();
	});

	it('offers Redeploy as a way out, not as something dangerous', async () => {
		await render(DeploymentStatusBanner, { ...failed, onRedeploy: vi.fn() });

		const redeploy = page.getByRole('button', { name: 'Redeploy' });
		await expect.element(redeploy).toBeVisible();
		expect(redeploy.element().className).toContain('bg-primary');
		expect(redeploy.element().className).not.toContain('bg-error');
	});

	it('offers "Build ulang dari awal" beside Redeploy where the project has a live image', async () => {
		const onRedeploy = vi.fn();
		await render(DeploymentStatusBanner, { ...failed, onRedeploy, offerForceBuild: true });

		await page.getByRole('button', { name: 'Pilihan cara build' }).click();
		await page.getByRole('menuitem', { name: 'Build ulang dari awal' }).click();

		expect(onRedeploy).toHaveBeenCalledExactlyOnceWith({ forceBuild: true });
	});

	it('takes the error button to the log', async () => {
		const onViewError = vi.fn();
		await render(DeploymentStatusBanner, { ...failed, onRedeploy: vi.fn(), onViewError });

		await page.getByRole('button', { name: 'Lihat error di log' }).click();

		expect(onViewError).toHaveBeenCalledOnce();
	});
});

describe('a failed release command', () => {
	it("shows the API's words with the exit code from the detail", async () => {
		await render(DeploymentStatusBanner, {
			status: 'failed',
			failureCategory: 'release',
			failureCode: 'release_command_failed',
			failureSummary:
				'Perintah rilis keluar dengan kode selain 0, jadi versi baru tidak dijalankan.',
			failureDetail: 'exit code 1',
			userFixable: true,
			recoveryHint: 'Buka log deployment bagian rilis untuk melihat error-nya.',
			onRedeploy: vi.fn()
		});

		await expect
			.element(page.getByText('Deployment gagal saat menjalankan release command'))
			.toBeVisible();
		await expect.element(page.getByText('exit code 1')).toBeVisible();
		await expect.element(page.getByText('release_command_failed')).toBeVisible();
		await expect
			.element(page.getByText('Buka log deployment bagian rilis untuk melihat error-nya.'))
			.toBeVisible();
	});
});

describe('a failed deployment', () => {
	const failed = {
		status: 'failed' as const,
		failedStepLabel: 'Mengecek aplikasi',
		failureCategory: 'app',
		failureSummary: 'Aplikasi berjalan, tetapi tidak menerima koneksi.',
		userFixable: true,
		recoveryHint: 'Dengarkan di 0.0.0.0 dan baca port dari PORT.'
	};

	it('links a code the guide explains to its heading, in a new tab', async () => {
		await render(DeploymentStatusBanner, { ...failed, failureCode: 'runtime_app_not_listening' });

		const link = page.getByRole('link', { name: /baca penjelasan kode ini/ });
		await expect
			.element(link)
			.toHaveAttribute('href', 'https://sakala.dev/docs/deploy-gagal#runtime_app_not_listening');
		await expect.element(link).toHaveAttribute('target', '_blank');
	});

	it('gives no link for a code the guide does not cover', async () => {
		await render(DeploymentStatusBanner, { ...failed, failureCode: 'something_new' });

		await expect.element(page.getByText('something_new')).toBeVisible();
		await expect.element(page.getByTestId('failure-docs-link')).not.toBeInTheDocument();
	});

	it('names the variables from .env.example that are not set, with the way to set them', async () => {
		await render(DeploymentStatusBanner, {
			...failed,
			failureCode: 'runtime_app_not_listening',
			missingEnvVariables: {
				sentence: '.env.example di repository-mu menyebut 1 variabel yang belum ada: APP_KEY.',
				action: 'Isi di tab Variabel',
				href: '/projects/p-1/environments#isi-dari-env-example'
			}
		});

		await expect.element(page.getByTestId('missing-env-variables')).toHaveTextContent('APP_KEY');
		await expect
			.element(page.getByRole('link', { name: 'Isi di tab Variabel' }))
			.toHaveAttribute('href', '/projects/p-1/environments#isi-dari-env-example');
	});
});

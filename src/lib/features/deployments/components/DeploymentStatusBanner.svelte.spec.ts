import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import '../../../../app.css';
import DeploymentStatusBanner from './DeploymentStatusBanner.svelte';

const live = {
	status: 'success' as const,
	durationLabel: '1 menit 52 detik',
	servingState: 'live' as const,
	publicUrl: 'https://toko-kopi-web.run.sakala.dev'
};

describe('the moment a project first goes live', () => {
	it('names the project, gives the address, and keeps open and copy together', async () => {
		render(DeploymentStatusBanner, { ...live, firstLiveProjectName: 'toko-kopi-web' });

		await expect
			.element(page.getByRole('heading', { name: 'toko-kopi-web sudah live' }))
			.toBeVisible();
		await expect
			.element(page.getByRole('link', { name: 'toko-kopi-web.run.sakala.dev' }))
			.toHaveAttribute('href', live.publicUrl);
		await expect.element(page.getByRole('link', { name: 'Buka situs' })).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Salin URL' })).toBeVisible();
	});

	it('copies the whole address', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
		render(DeploymentStatusBanner, { ...live, firstLiveProjectName: 'toko-kopi-web' });

		await page.getByRole('button', { name: 'Salin URL' }).click();

		expect(writeText).toHaveBeenCalledWith(live.publicUrl);
	});

	it('stays calm for a later deployment', async () => {
		render(DeploymentStatusBanner, { ...live, firstLiveProjectName: null });

		await expect.element(page.getByRole('heading', { name: 'Deployment berhasil' })).toBeVisible();
		await expect.element(page.getByTestId('first-live')).not.toBeInTheDocument();
	});

	it.each(['crash_looping', 'not_serving', 'superseded', 'unconfirmed'] as const)(
		'claims nothing when the app is %s',
		async (servingState) => {
			render(DeploymentStatusBanner, {
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
		render(DeploymentStatusBanner, {
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
		render(DeploymentStatusBanner, { ...failed, onRedeploy: vi.fn(), onViewError: vi.fn() });

		await expect
			.element(page.getByRole('heading', { name: 'Deployment gagal saat build' }))
			.toBeVisible();
		await expect.element(page.getByText(failed.failureSummary)).toBeVisible();
		await expect.element(page.getByText('Cara memperbaiki:')).toBeVisible();
		await expect.element(page.getByText(failed.failureDetail)).toBeVisible();
		await expect.element(page.getByText(failed.failureCode)).toBeVisible();
	});

	it('offers Redeploy as a way out, not as something dangerous', async () => {
		render(DeploymentStatusBanner, { ...failed, onRedeploy: vi.fn() });

		const redeploy = page.getByRole('button', { name: 'Redeploy' });
		await expect.element(redeploy).toBeVisible();
		expect(redeploy.element().className).toContain('bg-primary');
		expect(redeploy.element().className).not.toContain('bg-error');
	});

	it('takes the error button to the log', async () => {
		const onViewError = vi.fn();
		render(DeploymentStatusBanner, { ...failed, onRedeploy: vi.fn(), onViewError });

		await page.getByRole('button', { name: 'Lihat error di log' }).click();

		expect(onViewError).toHaveBeenCalledOnce();
	});
});

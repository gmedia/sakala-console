import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import AutoDetectStep from './AutoDetectStep.svelte';
import { apiRequest } from '$lib/api/client';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$lib/api/client', () => ({ apiRequest: vi.fn() }));

const pendingProject = {
	id: 'p-1',
	name: 'toko-kopi',
	repository_full_name: 'rani/toko-kopi',
	repository_url: 'https://github.com/rani/toko-kopi',
	branch: 'main',
	default_domain: 'toko-kopi.apps.example.test',
	configured_port: null,
	detected_port: null,
	effective_port: 3000,
	preview_status: 'pending',
	inspection: null,
	stack: null,
	inspection_error_code: null
};

function renderStep(patienceMs: number) {
	return render(QueryTestHost, {
		props: { component: AutoDetectStep, props: { projectId: 'p-1', patienceMs } }
	});
}

describe('AutoDetectStep while inspection stays pending', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(apiRequest).mockImplementation(async (_path, options) => ({
			data: options?.method === 'POST' ? { id: 'd-1' } : pendingProject
		}));
	});

	it('a slow analysis is not called failed, and Deploy waits two minutes by default', async () => {
		await render(QueryTestHost, {
			props: { component: AutoDetectStep, props: { projectId: 'p-1' } }
		});

		await expect.element(page.getByText('satu menit atau lebih')).toBeVisible();
		await new Promise((done) => setTimeout(done, 100));
		await expect.element(page.getByRole('button', { name: 'Deploy sekarang' })).toBeDisabled();
	});

	it('holds Deploy back at first', async () => {
		await renderStep(60_000);

		await expect.element(page.getByRole('button', { name: 'Deploy sekarang' })).toBeDisabled();
		await expect.element(page.getByText('tidak perlu menunggu hasilnya')).not.toBeInTheDocument();
	});

	it('offers Deploy once it took too long, because a deploy does not need the result', async () => {
		await renderStep(20);

		await expect.element(page.getByText('tidak perlu menunggu hasilnya')).toBeVisible();
		await expect.element(page.getByText('belum berarti gagal')).toBeVisible();
		const deploy = page.getByRole('button', { name: 'Deploy sekarang' });
		await expect.element(deploy).toBeEnabled();

		await deploy.click();

		await vi.waitFor(() =>
			expect(apiRequest).toHaveBeenCalledWith(
				'/api/v1/app/projects/p-1/deployments',
				expect.objectContaining({ method: 'POST', json: { branch: 'main' } })
			)
		);
	});
});

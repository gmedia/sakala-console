import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { goto } from '$app/navigation';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import FirstDeployStepTestHost from './FirstDeployStepTestHost.svelte';
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
	configured_port: null as number | null,
	detected_port: null,
	effective_port: 3000,
	preview_status: 'pending',
	inspection: null,
	stack: null,
	inspection_error_code: null,
	latest_deployment: null as { id: string } | null
};

let project = { ...pendingProject };

function renderStep(props: Record<string, unknown> = {}) {
	return render(QueryTestHost, {
		props: { component: FirstDeployStepTestHost, props: { projectId: 'p-1', ...props } }
	});
}

const deployCalls = () =>
	vi.mocked(apiRequest).mock.calls.filter(([path]) => String(path).endsWith('/deployments'));

beforeEach(() => {
	vi.clearAllMocks();
	project = { ...pendingProject };
	vi.mocked(apiRequest).mockImplementation(async (_path, options) => ({
		data: options?.method === 'POST' ? { id: 'd-1' } : project
	}));
});

describe('FirstDeployStep while inspection stays pending', () => {
	it('a slow analysis is not called failed, and Deploy waits two minutes by default', async () => {
		await renderStep();

		await expect.element(page.getByText('satu menit atau lebih')).toBeVisible();
		await new Promise((done) => setTimeout(done, 100));
		await expect.element(page.getByRole('button', { name: 'Deploy sekarang' })).toBeDisabled();
	});

	it('offers Deploy once it took too long, and says the deployment waits for the port', async () => {
		await renderStep({ patienceMs: 20 });

		await expect.element(page.getByText('Kamu boleh deploy sekarang')).toBeVisible();
		await expect
			.element(page.getByText(/menunggu analisis selesai supaya memakai port/))
			.toBeVisible();
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

describe('FirstDeployStep after "Buat dan deploy"', () => {
	it('starts the deployment at once when the port is configured, without waiting for detection', async () => {
		project = { ...pendingProject, configured_port: 8080 };
		await renderStep({ autoDeploy: true, patienceMs: 60_000 });

		await vi.waitFor(() => expect(deployCalls()).toHaveLength(1));
		await vi.waitFor(() => expect(goto).toHaveBeenCalledWith('/projects/p-1/deployments/d-1'));
	});

	it('waits for detection while the port is unknown, then starts by itself', async () => {
		await renderStep({ autoDeploy: true, patienceMs: 60_000 });

		await expect.element(page.getByText(/Deploy dimulai otomatis setelah itu/)).toBeVisible();
		expect(deployCalls()).toHaveLength(0);

		project = { ...pendingProject, preview_status: 'succeeded' };
		await vi.waitFor(() => expect(deployCalls()).toHaveLength(1), { timeout: 10_000 });
	});

	it('opens the deployment it already started after a reload, instead of a second one', async () => {
		project = { ...pendingProject, preview_status: 'succeeded', latest_deployment: { id: 'd-0' } };
		await renderStep({ autoDeploy: true });

		await vi.waitFor(() => expect(goto).toHaveBeenCalledWith('/projects/p-1/deployments/d-0'));
		expect(deployCalls()).toHaveLength(0);
	});

	it('does not deploy by itself when detection failed', async () => {
		project = { ...pendingProject, preview_status: 'failed' };
		await renderStep({ autoDeploy: true });

		await expect.element(page.getByRole('button', { name: 'Deteksi ulang' })).toBeVisible();
		expect(deployCalls()).toHaveLength(0);
	});
});

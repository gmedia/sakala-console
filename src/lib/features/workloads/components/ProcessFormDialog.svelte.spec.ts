import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { createProcess, parseProcess, updateProcess } from '$lib/api/resources/processes';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import { errorFromWorkloadFixture, getWorkloadFixture } from '$lib/testing/workload-fixtures';
import ProcessFormDialog from './ProcessFormDialog.svelte';

vi.mock('$lib/config/public', () => ({
	publicConfig: { apiUrl: 'http://api.test', appUrl: 'http://app.test' }
}));
vi.mock('$lib/api/resources/processes', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/resources/processes')>()),
	createProcess: vi.fn(),
	updateProcess: vi.fn()
}));

const created = parseProcess(getWorkloadFixture('process-create').body);

function open(props: Record<string, unknown> = {}) {
	return render(QueryTestHost, {
		props: {
			component: ProcessFormDialog,
			props: {
				open: true,
				projectId: 'p-1',
				takenNames: ['queue'],
				maxReplicas: 2,
				maxMemoryMb: 512,
				maxCpuMillis: 1000,
				...props
			}
		}
	});
}

const dialog = () => page.getByRole('dialog');

beforeEach(() => {
	vi.mocked(createProcess).mockReset();
	vi.mocked(updateProcess).mockReset();
});

describe('ProcessFormDialog', () => {
	it('explains a reserved name and a duplicate before sending anything', async () => {
		await open();
		await dialog().getByLabelText('Nama').fill('web');
		await dialog().getByLabelText('Perintah').fill('npm run worker');
		await dialog().getByRole('button', { name: 'Simpan worker' }).click();
		await expect
			.element(dialog().getByText(/Nama web, release, dan job dipakai Sakala/))
			.toBeVisible();
		await dialog().getByLabelText('Nama').fill('queue');
		await dialog().getByRole('button', { name: 'Simpan worker' }).click();
		await expect.element(dialog().getByText(/sudah punya worker dengan nama itu/)).toBeVisible();
		expect(createProcess).not.toHaveBeenCalled();
	});

	it('adds a worker from the Laravel suggestion with one container', async () => {
		vi.mocked(createProcess).mockResolvedValue(created);
		await open({
			takenNames: [],
			preset: {
				name: 'queue',
				command: 'php artisan queue:work --sleep=3 --tries=3 --max-time=3600'
			}
		});
		await expect.element(dialog().getByLabelText('Nama')).toHaveValue('queue');
		await expect.element(dialog().getByLabelText('Container', { exact: true })).toHaveValue(1);
		await dialog().getByRole('button', { name: 'Simpan worker' }).click();
		expect(createProcess).toHaveBeenCalledWith('p-1', {
			name: 'queue',
			command: 'php artisan queue:work --sleep=3 --tries=3 --max-time=3600',
			replicas: 1,
			memory_mb: null,
			cpu_millis: null
		});
		await expect.element(dialog()).not.toBeInTheDocument();
	});

	it('puts the API refusal of the worker quota on the container field', async () => {
		vi.mocked(updateProcess).mockRejectedValue(
			errorFromWorkloadFixture('process-update-worker-limit')
		);
		await open({ process: { ...created, name: 'mailer', id: 'pr-2' } });
		await dialog().getByLabelText('Container', { exact: true }).fill('2');
		await dialog().getByRole('button', { name: 'Simpan worker' }).click();
		expect(updateProcess).toHaveBeenCalledWith('p-1', 'pr-2', { replicas: 2 });
		await expect
			.element(dialog().getByText(/paling banyak menjalankan 2 worker sekaligus/))
			.toBeVisible();
	});
});

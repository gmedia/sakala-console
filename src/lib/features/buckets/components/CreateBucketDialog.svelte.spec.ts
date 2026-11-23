import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { goto } from '$app/navigation';
import { createBucket, createProjectBucket, parseBucket } from '$lib/api/resources/buckets';
import { listRegions } from '$lib/api/resources/regions';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import { errorFromBucketFixture, getBucketFixture } from '$lib/testing/bucket-fixtures';
import CreateBucketDialog from './CreateBucketDialog.svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn().mockResolvedValue(undefined) }));
vi.mock('$lib/config/public', () => ({
	publicConfig: { apiUrl: 'http://api.test', appUrl: 'http://app.test' }
}));
vi.mock('$lib/api/resources/buckets', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/resources/buckets')>()),
	createBucket: vi.fn(),
	createProjectBucket: vi.fn()
}));
vi.mock('$lib/api/resources/regions', () => ({ listRegions: vi.fn() }));

const created = parseBucket(getBucketFixture('bucket-create').body);

function open(props: Record<string, unknown> = {}) {
	return render(QueryTestHost, {
		props: {
			component: CreateBucketDialog,
			props: {
				open: true,
				workspaceId: 'ws-1',
				workspaceName: 'Tim Facility',
				defaultQuotaMb: 256,
				maxQuotaMb: 594,
				...props
			}
		}
	});
}

const dialog = (name = 'Buat bucket') => page.getByRole('dialog', { name });

beforeEach(() => {
	vi.mocked(createBucket).mockReset();
	vi.mocked(createProjectBucket).mockReset();
	vi.mocked(listRegions).mockReset().mockResolvedValue(['jkt']);
	vi.mocked(goto).mockClear();
});

describe('CreateBucketDialog', () => {
	it('starts with the default quota, names what is left, and asks for a name first', async () => {
		await open();
		await expect.element(dialog().getByLabelText('Kuota (MB)')).toHaveValue('256');
		await expect.element(dialog()).toHaveTextContent(/Sisa jatah: 594 MB/);
		await expect.element(dialog()).toHaveTextContent(/Upload yang melewati kuota ditolak/);
		await dialog().getByRole('button', { name: 'Buat bucket' }).click();
		await expect.element(dialog().getByText(/Isi nama bucket/)).toBeVisible();
		expect(createBucket).not.toHaveBeenCalled();
	});

	it('refuses a quota above what the workspace has left, before sending', async () => {
		await open();
		await dialog().getByLabelText('Nama bucket').fill('unggahan');
		await dialog().getByLabelText('Kuota (MB)').fill('600');
		await dialog().getByRole('button', { name: 'Buat bucket' }).click();
		await expect.element(dialog().getByRole('alert')).toHaveTextContent(/Isi 594 atau kurang/);
		await dialog().getByLabelText('Kuota (MB)').fill('0');
		await dialog().getByRole('button', { name: 'Buat bucket' }).click();
		await expect.element(dialog().getByRole('alert')).toHaveTextContent(/paling kecil 1/);
		expect(createBucket).not.toHaveBeenCalled();
	});

	it('creates the bucket and opens its page', async () => {
		vi.mocked(createBucket).mockResolvedValue(created);
		await open();
		await dialog().getByLabelText('Nama bucket').fill('  unggahan-toko  ');
		await dialog().getByLabelText('Kuota (MB)').fill('100');
		await dialog().getByRole('button', { name: 'Buat bucket' }).click();
		expect(createBucket).toHaveBeenCalledWith('ws-1', {
			name: 'unggahan-toko',
			region: null,
			quota_mb: 100
		});
		await expect
			.poll(() => vi.mocked(goto).mock.calls[0]?.[0])
			.toMatch(new RegExp(`/buckets/${created.id}\\?workspace=ws-1`));
	});

	it('creates for a project without a name, attached in the same step', async () => {
		vi.mocked(createProjectBucket).mockResolvedValue(created);
		await open({ project: { id: 'p-1', name: 'toko-kopi-web', region: 'jkt' } });
		const d = dialog('Buat bucket untuk proyek ini');
		await expect.element(d).toHaveTextContent(/langsung dipasang ke toko-kopi-web/);
		await expect.element(d.getByLabelText('Region')).toHaveValue('jkt');
		await d.getByRole('button', { name: 'Buat bucket' }).click();
		expect(createProjectBucket).toHaveBeenCalledWith('ws-1', {
			name: null,
			region: 'jkt',
			quota_mb: 256,
			project_id: 'p-1'
		});
	});

	it('explains a refusal from the API in the form', async () => {
		vi.mocked(createBucket).mockRejectedValue(
			errorFromBucketFixture('bucket-create-capacity-unavailable')
		);
		await open();
		await dialog().getByLabelText('Nama bucket').fill('besar');
		await dialog().getByRole('button', { name: 'Buat bucket' }).click();
		await expect
			.element(page.getByTestId('create-bucket-error'))
			.toHaveTextContent(/tidak punya ruang untuk kuota sebesar ini/);
	});

	it('says why instead of the form when the workspace cannot create one', async () => {
		await open({ blockedReason: 'Workspace ini sudah memakai 3 dari 3 bucket.' });
		await expect
			.element(page.getByTestId('create-bucket-blocked'))
			.toHaveTextContent('Workspace ini sudah memakai 3 dari 3 bucket.');
		await expect.element(dialog().getByLabelText('Nama bucket')).not.toBeInTheDocument();
	});
});

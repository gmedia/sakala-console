import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { goto } from '$app/navigation';
import {
	deleteBucket,
	parseBucket,
	parseBucketList,
	updateBucket,
	type Bucket
} from '$lib/api/resources/buckets';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import { errorFromBucketFixture, getBucketFixture } from '$lib/testing/bucket-fixtures';
import BucketSettingsCard from './BucketSettingsCard.svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn().mockResolvedValue(undefined) }));
vi.mock('$lib/config/public', () => ({
	publicConfig: { apiUrl: 'http://api.test', appUrl: 'http://app.test' }
}));
vi.mock('$lib/api/resources/buckets', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/resources/buckets')>()),
	deleteBucket: vi.fn(),
	updateBucket: vi.fn()
}));

const all = parseBucketList(getBucketFixture('buckets').body);
const attached = all.find((bucket) => bucket.projects.length > 0)!;
const free = all.find((bucket) => bucket.name === 'cadangan')!;
const pendingQuota = parseBucket(getBucketFixture('bucket-show-pending-quota').body);

const renderCard = (bucket: Bucket, maxQuotaMb: number | null = 850) =>
	render(QueryTestHost, {
		props: { component: BucketSettingsCard, props: { bucket, workspaceId: 'ws-1', maxQuotaMb } }
	});

beforeEach(() => {
	vi.mocked(deleteBucket).mockReset();
	vi.mocked(updateBucket).mockReset();
	vi.mocked(goto).mockClear();
});

describe('BucketSettingsCard', () => {
	it('blocks deleting while projects are attached, and says which', async () => {
		renderCard(attached);
		await expect.element(page.getByTestId('delete-bucket')).toBeDisabled();
		await expect
			.element(page.getByTestId('bucket-delete-blocked'))
			.toHaveTextContent(/Masih dipasang ke toko-kopi-web/);
	});

	it('deletes only after the name is typed, and says how long backups keep the files', async () => {
		vi.mocked(deleteBucket).mockResolvedValue(null);
		renderCard(free);
		await page.getByTestId('delete-bucket').click();
		const dialog = page.getByRole('dialog', { name: `Hapus ${free.name}?` });
		await expect.element(dialog).toHaveTextContent(/sekitar dua minggu/);
		const confirm = dialog.getByRole('button', { name: 'Hapus bucket ini' });
		await expect.element(confirm).toBeDisabled();
		await dialog.getByLabelText(/untuk konfirmasi/).fill(free.name);
		await confirm.click();
		expect(deleteBucket).toHaveBeenCalledWith('ws-1', free.id);
		await expect.poll(() => vi.mocked(goto).mock.calls.length).toBe(1);
	});

	it('warns when the new quota is below what the bucket holds, and still sends it', async () => {
		vi.mocked(updateBucket).mockResolvedValue(pendingQuota);
		renderCard(attached);
		const input = page.getByLabelText('Kuota (MB)');
		await input.fill('10');
		await expect
			.element(page.getByTestId('bucket-quota-below-usage'))
			.toHaveTextContent(/lebih kecil dari isi bucket sekarang/);
		await page.getByRole('button', { name: 'Simpan kuota' }).click();
		expect(updateBucket).toHaveBeenCalledWith('ws-1', attached.id, { quota_mb: 10 });
	});

	it('refuses a quota above what the workspace allows, before sending', async () => {
		renderCard(attached, 300);
		await page.getByLabelText('Kuota (MB)').fill('400');
		await page.getByRole('button', { name: 'Simpan kuota' }).click();
		await expect.element(page.getByRole('alert')).toHaveTextContent(/Isi 300 atau kurang/);
		expect(updateBucket).not.toHaveBeenCalled();
	});

	it('shows the API text when a quota change is already open', async () => {
		vi.mocked(updateBucket).mockRejectedValue(errorFromBucketFixture('bucket-quota-busy'));
		renderCard(attached);
		await page.getByLabelText('Kuota (MB)').fill('300');
		await page.getByRole('button', { name: 'Simpan kuota' }).click();
		await expect
			.element(page.getByRole('alert'))
			.toHaveTextContent(
				'Perubahan kuota sebelumnya masih berjalan. Tunggu sampai selesai, lalu coba lagi.'
			);
	});

	it('keeps the quota field closed while a change is on its way', async () => {
		renderCard(pendingQuota);
		await expect.element(page.getByLabelText('Kuota (MB)')).toBeDisabled();
		await expect
			.element(page.getByTestId('bucket-quota-settings'))
			.toHaveTextContent(/masih diterapkan/);
	});

	it('renames without touching the node', async () => {
		vi.mocked(updateBucket).mockResolvedValue({ ...attached, name: 'unggahan-baru' });
		renderCard(attached);
		await page.getByLabelText('Nama bucket').fill('unggahan-baru');
		await page.getByRole('button', { name: 'Simpan nama' }).click();
		expect(updateBucket).toHaveBeenCalledWith('ws-1', attached.id, { name: 'unggahan-baru' });
	});
});

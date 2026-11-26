import { page, userEvent } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import {
	parseBucket,
	parseBucketList,
	updateBucket,
	type Bucket
} from '$lib/api/resources/buckets';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import { errorFromBucketFixture, getBucketFixture } from '$lib/testing/bucket-fixtures';
import BucketOverviewCard from './BucketOverviewCard.svelte';

vi.mock('$app/navigation', () => ({
	goto: vi.fn(),
	replaceState: vi.fn(),
	afterNavigate: vi.fn()
}));
vi.mock('$app/state', () => ({ page: { url: new URL('http://app.test/buckets/b'), state: {} } }));
vi.mock('$lib/config/public', () => ({
	publicConfig: { apiUrl: 'http://api.test', appUrl: 'http://app.test' }
}));
vi.mock('$lib/api/resources/buckets', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/resources/buckets')>()),
	updateBucket: vi.fn()
}));

const all = parseBucketList(getBucketFixture('buckets').body);
const attached = all.find((bucket) => bucket.projects.length > 0)!;
const pendingQuota = parseBucket(getBucketFixture('bucket-show-pending-quota').body);

const renderCard = (bucket: Bucket, maxQuotaMb: number | null = 850, canManage = true) =>
	render(QueryTestHost, {
		props: {
			component: BucketOverviewCard,
			props: { bucket, workspaceId: 'ws-1', canManage, maxQuotaMb }
		}
	});

const editQuota = () => page.getByRole('button', { name: 'Ubah kuota bucket' });

beforeEach(() => {
	vi.mocked(updateBucket).mockReset();
});

describe('BucketOverviewCard editing in place', () => {
	it('gives a viewer the values without any way to edit them', async () => {
		renderCard(attached, 850, false);
		await expect.element(page.getByTestId('bucket-facts')).toBeVisible();
		await expect.element(page.getByRole('button', { name: /^Ubah/ })).not.toBeInTheDocument();
	});

	it('opens the quota beside its value, focused, and Escape closes it back to Ubah', async () => {
		renderCard(attached);
		await editQuota().click();
		await expect.element(editQuota()).toHaveAttribute('aria-expanded', 'true');
		await expect.element(page.getByLabelText('Kuota (MB)')).toHaveFocus();
		await userEvent.keyboard('{Escape}');
		await expect.element(page.getByLabelText('Kuota (MB)')).not.toBeInTheDocument();
		await expect.element(editQuota()).toHaveFocus();
		expect(updateBucket).not.toHaveBeenCalled();
	});

	it('warns when the new quota is below what the bucket holds, sends it, and closes', async () => {
		vi.mocked(updateBucket).mockResolvedValue(pendingQuota);
		renderCard(attached);
		await editQuota().click();
		await page.getByLabelText('Kuota (MB)').fill('10');
		await expect
			.element(page.getByTestId('bucket-quota-below-usage'))
			.toHaveTextContent(/lebih kecil dari isi bucket sekarang/);
		await page.getByRole('button', { name: 'Simpan kuota' }).click();
		expect(updateBucket).toHaveBeenCalledWith('ws-1', attached.id, { quota_mb: 10 });
		await expect.element(page.getByLabelText('Kuota (MB)')).not.toBeInTheDocument();
	});

	it('refuses a quota above what the workspace allows, before sending', async () => {
		renderCard(attached, 300);
		await editQuota().click();
		await page.getByLabelText('Kuota (MB)').fill('400');
		await page.getByRole('button', { name: 'Simpan kuota' }).click();
		await expect.element(page.getByRole('alert')).toHaveTextContent(/Isi 300 atau kurang/);
		expect(updateBucket).not.toHaveBeenCalled();
	});

	it('shows the API text when a quota change is already open, and stays open', async () => {
		vi.mocked(updateBucket).mockRejectedValue(errorFromBucketFixture('bucket-quota-busy'));
		renderCard(attached);
		await editQuota().click();
		await page.getByLabelText('Kuota (MB)').fill('300');
		await page.getByRole('button', { name: 'Simpan kuota' }).click();
		await expect
			.element(page.getByRole('alert'))
			.toHaveTextContent(
				'Perubahan kuota sebelumnya masih berjalan. Tunggu sampai selesai, lalu coba lagi.'
			);
		await expect.element(page.getByLabelText('Kuota (MB)')).toBeVisible();
	});

	it('shows a change on its way beside the quota, and keeps the field closed', async () => {
		renderCard(pendingQuota);
		await expect.element(page.getByTestId('bucket-quota-value')).toHaveTextContent(/menjadi/);
		await editQuota().click();
		await expect.element(page.getByLabelText('Kuota (MB)')).toBeDisabled();
		await expect
			.element(page.getByTestId('bucket-quota-settings'))
			.toHaveTextContent(/masih diterapkan/);
	});

	it('renames in place without touching the node', async () => {
		vi.mocked(updateBucket).mockResolvedValue({ ...attached, name: 'unggahan-baru' });
		renderCard(attached);
		await page.getByRole('button', { name: 'Ubah nama bucket' }).click();
		await expect.element(page.getByLabelText('Nama bucket', { exact: true })).toHaveFocus();
		await page.getByLabelText('Nama bucket', { exact: true }).fill('unggahan-baru');
		await page.getByRole('button', { name: 'Simpan nama' }).click();
		expect(updateBucket).toHaveBeenCalledWith('ws-1', attached.id, { name: 'unggahan-baru' });
		await expect.element(page.getByRole('button', { name: 'Ubah nama bucket' })).toHaveFocus();
	});

	it('checks an empty name before sending', async () => {
		renderCard(attached);
		await page.getByRole('button', { name: 'Ubah nama bucket' }).click();
		await page.getByLabelText('Nama bucket', { exact: true }).fill('  ');
		await page.getByRole('button', { name: 'Simpan nama' }).click();
		await expect.element(page.getByText('Isi nama bucket.')).toBeVisible();
		expect(updateBucket).not.toHaveBeenCalled();
	});
});

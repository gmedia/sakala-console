import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { goto } from '$app/navigation';
import { deleteBucket, parseBucketList, type Bucket } from '$lib/api/resources/buckets';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import { getBucketFixture } from '$lib/testing/bucket-fixtures';
import BucketDangerZone from './BucketDangerZone.svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn().mockResolvedValue(undefined) }));
vi.mock('$lib/config/public', () => ({
	publicConfig: { apiUrl: 'http://api.test', appUrl: 'http://app.test' }
}));
vi.mock('$lib/api/resources/buckets', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/resources/buckets')>()),
	deleteBucket: vi.fn()
}));

const all = parseBucketList(getBucketFixture('buckets').body);
const attached = all.find((bucket) => bucket.projects.length > 0)!;
const free = all.find((bucket) => bucket.name === 'cadangan')!;

const renderCard = (bucket: Bucket) =>
	render(QueryTestHost, {
		props: { component: BucketDangerZone, props: { bucket, workspaceId: 'ws-1' } }
	});

beforeEach(() => {
	vi.mocked(deleteBucket).mockReset();
	vi.mocked(goto).mockClear();
});

describe('BucketDangerZone', () => {
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
});

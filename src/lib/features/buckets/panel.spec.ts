import { describe, expect, it } from 'vitest';
import { parseBucket } from '$lib/api/resources/buckets';
import { getBucketFixture } from '$lib/testing/bucket-fixtures';
import { BUCKET_ANCHORS, deriveBucketSteps } from './panel';

const MB = 1024 * 1024;

/** A captured bucket, ready; attached and half empty unless a test says otherwise. */
const bucket = () => {
	const ready = parseBucket(getBucketFixture('bucket-show').body);
	return {
		...ready,
		status: 'ready',
		projects: [{ id: 'p-1', name: 'toko-kopi-web', slug: 'toko-kopi-web' }],
		quota_mb: 100,
		size_bytes: 10 * MB,
		pending_quota_mb: null
	};
};
const nearlyFull = () => ({ ...bucket(), size_bytes: 95 * MB });

describe('the bucket panel next steps', () => {
	it('suggests nothing for a bucket in use with room left', () => {
		expect(deriveBucketSteps(bucket(), true, null)).toEqual([]);
	});

	it('suggests attaching a bucket no project uses', () => {
		expect(deriveBucketSteps({ ...bucket(), projects: [] }, true, null)).toEqual([
			{ id: 'attach', label: 'Pasang ke proyek', href: `#${BUCKET_ANCHORS.projects}` }
		]);
	});

	it('suggests a bigger quota once the bucket is nearly full, while the workspace has room', () => {
		expect(deriveBucketSteps(nearlyFull(), true, null)).toEqual([
			{ id: 'quota', label: 'Naikkan kuota', href: `#${BUCKET_ANCHORS.quota}` }
		]);
		expect(deriveBucketSteps(nearlyFull(), true, 500).map((step) => step.id)).toEqual(['quota']);
		// No room left in the workspace, or a change already on its way: nothing to suggest.
		expect(deriveBucketSteps(nearlyFull(), true, 100)).toEqual([]);
		expect(deriveBucketSteps({ ...nearlyFull(), pending_quota_mb: 200 }, true, null)).toEqual([]);
	});

	it('gives a viewer and a bucket that is not ready nothing', () => {
		const idle = { ...nearlyFull(), projects: [] };
		expect(deriveBucketSteps(idle, false, null)).toEqual([]);
		for (const status of ['provisioning', 'locked', 'failed', 'deleting']) {
			expect(deriveBucketSteps({ ...idle, status }, true, null)).toEqual([]);
		}
	});
});

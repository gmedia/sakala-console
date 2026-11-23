import { describe, expect, it } from 'vitest';
import { NetworkError } from '$lib/api/errors';
import { parseBucket, parseBucketCredentials, parseBucketList } from '$lib/api/resources/buckets';
import { parsePilotLimitsResponse } from '$lib/api/resources/pilot-limits';
import { errorFromBucketFixture, getBucketFixture } from '$lib/testing/bucket-fixtures';
import type { ProjectBucket } from '$lib/features/projects/type';
import {
	BUCKET_TRANSITION_POLL_MS,
	BYTES_PER_MB,
	KEY_ROTATING_CREDENTIALS,
	KEY_ROTATION_POLL_MS,
	KEY_ROTATION_SKIPPED_REASONS,
	QUOTA_COPY,
	bucketEnvBlock,
	bucketErrorMessage,
	bucketQuota,
	bucketRedeployNoticeText,
	bucketRowNote,
	bucketStatusView,
	bucketsInUse,
	bucketsUnavailable,
	canOfferProjectBucket,
	defaultBucketQuotaMb,
	isBucketFull,
	isKeyUnknown,
	keyRotationView,
	pendingQuotaText,
	resolveBucketPollInterval,
	separateFailure
} from './presentation';
import { bucketVariableRows, overriddenBucketNames, overridesBucketKey } from './project-variables';

const limits = parsePilotLimitsResponse(getBucketFixture('pilot-limits-buckets').body);
const closedLimits = parsePilotLimitsResponse(getBucketFixture('pilot-limits-buckets-zero').body);
const ready = parseBucket(getBucketFixture('bucket-show').body);

describe('bucketStatusView', () => {
	it.each([
		['provisioning', 'Menyiapkan', 'running', true],
		['ready', 'Siap', 'success', false],
		['failed', 'Gagal', 'error', false],
		['deleting', 'Menghapus', 'queued', true],
		['locked', 'Dikunci', 'warning', false]
	] as const)('labels %s', (status, label, tone, transitional) => {
		const view = bucketStatusView({ status, last_failure: null });
		expect(view).toMatchObject({ label, tone, transitional });
		expect(view.description).not.toBe('');
	});

	it('says a locked bucket stops the app and its temporary links', () => {
		expect(bucketStatusView({ status: 'locked', last_failure: null }).description).toBe(
			'Bucket ini dikunci admin Sakala. Aplikasi tidak bisa membaca atau menulis berkas, dan link sementara tidak berlaku.'
		);
	});

	it('uses the API summary for a failed creation, and says to recreate it', () => {
		const failed = parseBucket(getBucketFixture('bucket-show-failed').body);
		const view = bucketStatusView(failed);
		expect(view.description).toContain('tidak punya cukup ruang');
		expect(view.description).toMatch(/Hapus bucket ini lalu buat lagi/);
		expect(separateFailure(failed)).toBeNull();
	});

	it('shows a status from a newer API as itself', () => {
		expect(bucketStatusView({ status: 'migrating', last_failure: null })).toMatchObject({
			label: 'migrating',
			tone: 'neutral'
		});
		expect(bucketRowNote({ status: 'migrating' })).toBeNull();
	});
});

describe('progressive disclosure', () => {
	it('shows buckets only to a workspace opened for them or holding one', () => {
		expect(bucketsInUse(limits)).toBe(true);
		expect(bucketsInUse(closedLimits)).toBe(false);
		expect(
			bucketsInUse({
				...closedLimits,
				quotas: { ...closedLimits.quotas, current_buckets_count: 1 }
			})
		).toBe(true);
		expect(bucketsInUse({ ...limits, buckets: undefined })).toBe(false);
		expect(bucketsInUse(undefined)).toBe(false);
	});

	it('offers a bucket for a project only when the workspace can still create one', () => {
		// The fixture's workspace uses 3 of 3 buckets.
		expect(canOfferProjectBucket(limits)).toBe(false);
		const roomy = { ...limits, quotas: { ...limits.quotas, max_buckets: 5 } };
		expect(canOfferProjectBucket(roomy)).toBe(true);
		expect(
			canOfferProjectBucket({ ...roomy, buckets: { available: false, default_quota_mb: 256 } })
		).toBe(false);
		expect(
			canOfferProjectBucket({
				...roomy,
				quotas: { ...roomy.quotas, current_bucket_storage_mb: 1000 }
			})
		).toBe(false);
		expect(canOfferProjectBucket(closedLimits)).toBe(false);
	});

	it('reads availability like databases: unknown is not unavailable', () => {
		expect(bucketsUnavailable(limits)).toBe(false);
		expect(bucketsUnavailable(undefined)).toBe(false);
		expect(bucketsUnavailable({ buckets: { available: false, default_quota_mb: 256 } })).toBe(true);
	});

	it('starts the quota at the server default, capped at what the workspace has left', () => {
		// 1000 MB, 406 reserved: 594 left, so the 256 MB default fits.
		expect(defaultBucketQuotaMb(limits)).toBe(256);
		const tight = { ...limits, quotas: { ...limits.quotas, current_bucket_storage_mb: 900 } };
		expect(defaultBucketQuotaMb(tight)).toBe(100);
		expect(defaultBucketQuotaMb(tight, true)).toBe(256);
	});
});

describe('bucketQuota', () => {
	it('names the count, the allocation, and the usage', () => {
		const quota = bucketQuota(limits.quotas)!;
		expect(quota.count.label).toBe('3 dari 3 bucket');
		expect(quota.count.full).toBe(true);
		expect(quota.allocation.label).toBe('dialokasikan 406 MB dari 1.000 MB');
		expect(quota.usedLabel).toBe('terpakai 36 MB');
		expect(quota.remainingMb).toBe(594);
		expect(quota.blockedReason).toBe(QUOTA_COPY.countFull(3));
	});

	it('says the workspace is not opened when the limit is 0', () => {
		expect(bucketQuota(closedLimits.quotas)?.blockedReason).toBe(QUOTA_COPY.disabled);
	});

	it('is null for an API without bucket quotas', () => {
		expect(bucketQuota({ ...limits.quotas, max_buckets: undefined })).toBeNull();
	});
});

describe('usage', () => {
	it('derives Penuh from the last report against the quota', () => {
		expect(isBucketFull(ready)).toBe(false);
		expect(isBucketFull({ size_bytes: 256 * BYTES_PER_MB, quota_mb: 256 })).toBe(true);
		expect(isBucketFull({ size_bytes: null, quota_mb: 1 })).toBe(false);
	});

	it('says a quota change is on its way', () => {
		const pending = parseBucket(getBucketFixture('bucket-show-pending-quota').body);
		expect(pendingQuotaText(pending)).toMatch(/^Kuota sedang diubah menjadi 512 MB\./);
		expect(pendingQuotaText(ready)).toBeNull();
	});
});

describe('polling', () => {
	it('polls fast while a rotation settles, briefly while a bucket changes, and not otherwise', () => {
		const pendingRotation = parseBucket(getBucketFixture('rotate-key-redeploy').body);
		expect(resolveBucketPollInterval([pendingRotation])).toBe(KEY_ROTATION_POLL_MS);
		expect(resolveBucketPollInterval(parseBucketList(getBucketFixture('buckets').body))).toBe(
			BUCKET_TRANSITION_POLL_MS
		);
		const pendingQuota = parseBucket(getBucketFixture('bucket-show-pending-quota').body);
		expect(resolveBucketPollInterval([pendingQuota])).toBe(BUCKET_TRANSITION_POLL_MS);
		expect(resolveBucketPollInterval([ready])).toBe(false);
		// An unknown rotation waits for a person, so the page stops asking.
		const unknown = parseBucket(getBucketFixture('bucket-show-rotation-unknown').body);
		expect(resolveBucketPollInterval([unknown])).toBe(false);
	});
});

describe('keyRotationView', () => {
	it('reads completed with the queued redeploys', () => {
		const completed = parseBucket(getBucketFixture('bucket-show-rotation-completed').body);
		const view = keyRotationView(completed);
		expect(view?.state).toBe('completed');
		if (view?.state !== 'completed') return;
		expect(view.completedText).toMatch(/^Secret key (sudah|terakhir) diganti/);
		expect(view.redeploys.get(completed.projects[0].id)?.deployment_id).toBeTruthy();
	});

	it('reads unknown on its own, apart from a failure that kept the old key', () => {
		const unknown = parseBucket(getBucketFixture('bucket-show-rotation-unknown').body);
		expect(keyRotationView(unknown)).toEqual({ state: 'unknown' });
		expect(isKeyUnknown(unknown)).toBe(true);
		// The rotation section explains it; the overview does not repeat the failure.
		expect(separateFailure(unknown)).toBeNull();
	});

	it('names the new skip reasons, and the requester in key words', () => {
		expect(KEY_ROTATION_SKIPPED_REASONS.bucket_key_rotating).toMatch(/sedang diganti/);
		expect(KEY_ROTATION_SKIPPED_REASONS.requester_cannot_deploy).toMatch(/mengganti secret key/);
		expect(KEY_ROTATION_SKIPPED_REASONS.bucket_not_ready).toMatch(/bucket proyek ini belum siap/);
	});
});

describe('bucketEnvBlock', () => {
	it('writes the credentials variables in the API order', () => {
		const credentials = parseBucketCredentials(getBucketFixture('credentials').body);
		const lines = bucketEnvBlock(credentials.variables!).split('\n');
		expect(lines[0]).toBe('AWS_ENDPOINT_URL_S3=https://s3.sakala.test');
		expect(lines.at(-1)).toBe(`AWS_SECRET_ACCESS_KEY=${credentials.secret_access_key}`);
		expect(lines).toHaveLength(8);
		expect(bucketEnvBlock({ NEW_ONE: 'x', AWS_BUCKET: 'b' })).toBe('AWS_BUCKET=b\nNEW_ONE=x');
	});
});

describe('bucketErrorMessage', () => {
	it('rebuilds the quota refusals from their fields', () => {
		expect(
			bucketErrorMessage(errorFromBucketFixture('bucket-create-limit-zero'), 'create', 'x')
		).toBe(QUOTA_COPY.disabled);
		expect(bucketErrorMessage(errorFromBucketFixture('bucket-create-limit'), 'create', 'x')).toBe(
			QUOTA_COPY.countFull(3)
		);
		expect(
			bucketErrorMessage(errorFromBucketFixture('bucket-quota-storage-limit'), 'quota', 'x')
		).toBe(
			'Kuota 900 MB melebihi sisa jatah penyimpanan bucket workspace ini, 388 MB dari 1.000 MB. Kecilkan kuotanya, kecilkan atau hapus bucket lain, atau minta admin Sakala menaikkan jatahnya.'
		);
		expect(
			bucketErrorMessage(errorFromBucketFixture('bucket-create-region-unavailable'), 'create', 'x')
		).toBe('Belum ada server penyimpanan di region sby. Pilih region lain, atau pilih Otomatis.');
	});

	it('explains a credentials read during an unsettled rotation in its own words', () => {
		expect(
			bucketErrorMessage(errorFromBucketFixture('credentials-key-rotating'), 'credentials', 'x')
		).toBe(KEY_ROTATING_CREDENTIALS);
	});

	it('keeps the API text for the other business refusals', () => {
		for (const name of [
			'attach-locked',
			'attach-not-ready',
			'attach-project-already-attached',
			'bucket-delete-in-use',
			'bucket-quota-busy',
			'rotate-key-busy',
			'bucket-create-capacity-unavailable'
		]) {
			const error = errorFromBucketFixture(name);
			expect(bucketErrorMessage(error, 'attach', 'x')).toBe(error.message);
		}
	});

	it('says who may act for a 403, and what happened for a 404', () => {
		expect(
			bucketErrorMessage(errorFromBucketFixture('credentials-member'), 'credentials', 'x')
		).toBe('Secret key hanya bisa dilihat pemilik workspace.');
		expect(
			bucketErrorMessage(errorFromBucketFixture('detach-not-attached'), 'detach', 'x')
		).toMatch(/sudah tidak terpasang/);
	});

	it('falls back for a network failure', () => {
		expect(
			bucketErrorMessage(new NetworkError(), 'load', 'Daftar bucket belum bisa dimuat.')
		).not.toBe('');
	});
});

describe('project variables', () => {
	const project = getBucketFixture('project-with-bucket').body as {
		data: { buckets: ProjectBucket[] };
	};
	const bucket = project.data.buckets[0];

	it('lists the injected names in order, with the overridden one marked', () => {
		const rows = bucketVariableRows(bucket);
		expect(rows.map((row) => row.name)).toEqual([
			'AWS_ENDPOINT_URL_S3',
			'AWS_ENDPOINT',
			'AWS_USE_PATH_STYLE_ENDPOINT',
			'AWS_DEFAULT_REGION',
			'AWS_REGION',
			'AWS_BUCKET',
			'AWS_ACCESS_KEY_ID',
			'AWS_SECRET_ACCESS_KEY'
		]);
		expect(rows.find((row) => row.overridden)?.name).toBe('AWS_DEFAULT_REGION');
		expect(overriddenBucketNames(project.data.buckets)).toEqual(new Set(['AWS_DEFAULT_REGION']));
	});

	it('warns harder only when the key pair is overridden', () => {
		expect(overridesBucketKey(bucket)).toBe(false);
		expect(overridesBucketKey({ ...bucket, overridden_variables: ['AWS_SECRET_ACCESS_KEY'] })).toBe(
			true
		);
	});

	it('tells which project to redeploy after attach and detach', () => {
		expect(
			bucketRedeployNoticeText({ projectId: 'p', projectName: 'toko', kind: 'attached' })
		).toBe('Redeploy toko supaya aplikasinya menerima variabel bucket ini.');
		expect(
			bucketRedeployNoticeText({ projectId: 'p', projectName: 'toko', kind: 'detached' })
		).toMatch(/Isinya tetap ada/);
	});
});

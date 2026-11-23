import { describe, expect, it, vi } from 'vitest';
import {
	bucketFixtureNames,
	errorFromBucketFixture,
	getBucketFixture
} from '$lib/testing/bucket-fixtures';
import { apiRequest } from '../client';
import { BUCKET_ERROR_CODES } from '../errors';
import { parseBucketRefusal } from './bucket-refusals';
import {
	attachBucket,
	createBucket,
	createProjectBucket,
	deleteBucket,
	detachBucket,
	parseBucket,
	parseBucketAttachment,
	parseBucketCredentials,
	parseBucketList,
	revealBucketCredentials,
	rotateBucketKey,
	updateBucket
} from './buckets';
import { parsePilotLimitsResponse } from './pilot-limits';

vi.mock('../client', () => ({ apiRequest: vi.fn() }));

const SUCCESS_PARSERS: Record<string, (body: unknown) => unknown> = {
	buckets: parseBucketList,
	'bucket-create': parseBucket,
	'bucket-create-for-project': parseBucket,
	'bucket-show': parseBucket,
	'bucket-show-failed': parseBucket,
	'bucket-show-pending-quota': parseBucket,
	'bucket-show-rotation-completed': parseBucket,
	'bucket-show-rotation-unknown': parseBucket,
	'bucket-rename': parseBucket,
	'bucket-quota': parseBucket,
	'bucket-delete': parseBucket,
	'rotate-key': parseBucket,
	'rotate-key-redeploy': parseBucket,
	attach: parseBucketAttachment,
	'attach-again': parseBucketAttachment,
	credentials: parseBucketCredentials,
	'pilot-limits-buckets': parsePilotLimitsResponse,
	'pilot-limits-buckets-zero': parsePilotLimitsResponse
};

describe('bucket resources, against responses captured from sakala-api', () => {
	it('tests every captured success response', () => {
		const successes = bucketFixtureNames().filter((name) => {
			const { status } = getBucketFixture(name);
			return status < 300 && status !== 204 && !name.startsWith('project-');
		});
		expect(successes.sort()).toEqual(Object.keys(SUCCESS_PARSERS).sort());
	});

	it.each(Object.entries(SUCCESS_PARSERS))('parses %s', (name, parse) => {
		expect(() => parse(getBucketFixture(name).body)).not.toThrow();
	});

	it('reads the list newest first, with a ready bucket and one still being created', () => {
		const buckets = parseBucketList(getBucketFixture('buckets').body);
		expect(buckets.map((bucket) => bucket.status)).toEqual(['ready', 'provisioning', 'ready']);
		const ready = buckets[2];
		expect(ready.projects.map((project) => project.name)).toEqual(['toko-kopi-web']);
		expect(ready.size_bytes).toBe(36 * 1024 * 1024);
		expect(ready.quota_mb).toBe(256);
		expect(buckets[1].connection).toBeNull();
	});

	it('gives every member the connection without the secret once the node reported it', () => {
		const bucket = parseBucket(getBucketFixture('bucket-show').body);
		expect(bucket.connection).toEqual({
			endpoint: 'https://s3.sakala.test',
			region: 'us-east-1',
			bucket: expect.stringMatching(/^b-[a-z0-9]{20}$/),
			access_key_id: expect.stringMatching(/^SK[A-Z0-9]{18}$/),
			path_style: true
		});
		expect(JSON.stringify(getBucketFixture('bucket-show').body)).not.toContain('secret');
	});

	it('reads a pending quota change and the rotation states, unknown included', () => {
		expect(parseBucket(getBucketFixture('bucket-show-pending-quota').body)).toMatchObject({
			quota_mb: 256,
			pending_quota_mb: 512
		});
		const completed = parseBucket(getBucketFixture('bucket-show-rotation-completed').body);
		expect(completed.key_rotation).toMatchObject({ status: 'completed', redeploy_attached: true });
		expect(completed.key_rotation?.redeploys?.[0].deployment_id).toBeTruthy();
		const unknown = parseBucket(getBucketFixture('bucket-show-rotation-unknown').body);
		expect(unknown.key_rotation?.status).toBe('unknown');
		expect(unknown.last_failure?.code).toBe('bucket_outcome_unknown');
		expect(parseBucket(getBucketFixture('rotate-key').body).key_rotation?.status).toBe('pending');
	});

	it('reads the credentials with exactly the variables attached projects receive', () => {
		const credentials = parseBucketCredentials(getBucketFixture('credentials').body);
		expect(Object.keys(credentials.variables ?? {})).toEqual([
			'AWS_ENDPOINT_URL_S3',
			'AWS_ENDPOINT',
			'AWS_USE_PATH_STYLE_ENDPOINT',
			'AWS_DEFAULT_REGION',
			'AWS_REGION',
			'AWS_BUCKET',
			'AWS_ACCESS_KEY_ID',
			'AWS_SECRET_ACCESS_KEY'
		]);
		expect(credentials.variables?.AWS_SECRET_ACCESS_KEY).toBe(credentials.secret_access_key);
	});

	it('reads the bucket quotas and availability from pilot-limits, and their absence', () => {
		const limits = parsePilotLimitsResponse(getBucketFixture('pilot-limits-buckets').body);
		expect(limits.quotas).toMatchObject({
			max_buckets: 3,
			current_buckets_count: 3,
			max_bucket_storage_mb: 1000,
			current_bucket_usage_bytes: 36 * 1024 * 1024
		});
		expect(limits.buckets).toEqual({ available: true, default_quota_mb: 256 });

		const older = structuredClone(getBucketFixture('pilot-limits-buckets').body) as {
			data: Record<string, unknown> & { quotas: Record<string, unknown> };
		};
		delete older.data.buckets;
		delete older.data.quotas.max_buckets;
		expect(parsePilotLimitsResponse(older).buckets).toBeUndefined();
	});

	it('reads the documented fields of each refusal', () => {
		expect(
			parseBucketRefusal(
				'BUCKET_LIMIT_EXCEEDED',
				errorFromBucketFixture('bucket-create-limit-zero').details
			)
		).toEqual({ limit: 0, current: 0 });
		expect(
			parseBucketRefusal(
				'BUCKET_STORAGE_LIMIT_EXCEEDED',
				errorFromBucketFixture('bucket-quota-storage-limit').details
			)
		).toEqual({ limit_mb: 1000, current_mb: 612, requested_mb: 900 });
		expect(
			parseBucketRefusal(
				'BUCKET_IN_USE',
				errorFromBucketFixture('bucket-delete-in-use').details
			)?.projects.map((project) => project.name)
		).toEqual(['toko-kopi-web']);
		expect(
			parseBucketRefusal(
				'PROJECT_BUCKET_ALREADY_ATTACHED',
				errorFromBucketFixture('attach-project-already-attached').details
			)?.bucket.name
		).toBe('unggahan-toko');
		expect(
			parseBucketRefusal(
				'BUCKET_KEY_ROTATING',
				errorFromBucketFixture('credentials-key-rotating').details
			)?.bucket.name
		).toBe('unggahan-toko-kopi');
		expect(parseBucketRefusal('BUCKET_LIMIT_EXCEEDED', { limit: 'x' })).toBeNull();
	});

	it('names each documented code the Console reads', () => {
		const codes = new Set(Object.values(BUCKET_ERROR_CODES));
		for (const name of bucketFixtureNames()) {
			const code = errorFromBucketFixture(name).code;
			if (code) expect(codes).toContain(code);
		}
	});
});

describe('bucket requests', () => {
	const mocked = vi.mocked(apiRequest);

	it('sends each request to its workspace-scoped path', async () => {
		mocked.mockResolvedValue(getBucketFixture('bucket-show').body);
		await createBucket('ws 1', { name: 'b', region: null, quota_mb: 10 });
		expect(mocked).toHaveBeenLastCalledWith('/api/v1/app/workspaces/ws%201/buckets', {
			method: 'POST',
			json: { name: 'b', region: null, quota_mb: 10 }
		});

		await createProjectBucket('ws', { name: null, region: null, quota_mb: 10, project_id: 'p-1' });
		expect(mocked).toHaveBeenLastCalledWith('/api/v1/app/workspaces/ws/buckets', {
			method: 'POST',
			json: { name: null, region: null, quota_mb: 10, project_id: 'p-1' }
		});

		await updateBucket('ws', 'b-1', { quota_mb: 512 });
		expect(mocked).toHaveBeenLastCalledWith('/api/v1/app/workspaces/ws/buckets/b-1', {
			method: 'PATCH',
			json: { quota_mb: 512 }
		});

		await rotateBucketKey('ws', 'b-1', { redeploy_attached: true });
		expect(mocked).toHaveBeenLastCalledWith('/api/v1/app/workspaces/ws/buckets/b-1/rotate-key', {
			method: 'POST',
			json: { redeploy_attached: true }
		});

		await deleteBucket('ws', 'b-1');
		expect(mocked).toHaveBeenLastCalledWith('/api/v1/app/workspaces/ws/buckets/b-1', {
			method: 'DELETE'
		});

		mocked.mockResolvedValue(getBucketFixture('attach').body);
		await attachBucket('ws', 'b-1', 'p-1');
		expect(mocked).toHaveBeenLastCalledWith(
			'/api/v1/app/workspaces/ws/buckets/b-1/attachments/p-1',
			{ method: 'POST' }
		);

		mocked.mockResolvedValue(undefined);
		await detachBucket('ws', 'b-1', 'p-1');
		expect(mocked).toHaveBeenLastCalledWith(
			'/api/v1/app/workspaces/ws/buckets/b-1/attachments/p-1',
			{ method: 'DELETE' }
		);
	});

	it('reads a 204 delete of a bucket nobody had created yet as nothing left', async () => {
		mocked.mockResolvedValue(undefined);
		await expect(deleteBucket('ws', 'b-1')).resolves.toBeNull();
	});

	it('never lets the browser cache the credentials', async () => {
		mocked.mockResolvedValue(getBucketFixture('credentials').body);
		await revealBucketCredentials('ws', 'b-1');
		expect(mocked).toHaveBeenLastCalledWith('/api/v1/app/workspaces/ws/buckets/b-1/credentials', {
			cache: 'no-store'
		});
	});
});

import { readFileSync } from 'node:fs';
import type { Page, Route } from '@playwright/test';
import { TEAM_WORKSPACE, workspaceProjects } from './databases';
import { baseProject, mockProjectApi, personalWorkspace, PROJECT_ID } from './project-detail';

/** Bodies captured from sakala-api #204 (tests/fixtures/buckets). */
export function capturedBucket<T = unknown>(name: string): { status: number; body: T } {
	const file = new URL(`../../fixtures/buckets/${name}.json`, import.meta.url);
	return JSON.parse(readFileSync(file, 'utf8')) as { status: number; body: T };
}

type ProjectRef = { id: string; name: string; slug: string };

export type MockBucket = {
	id: string;
	name: string;
	status: string;
	region: string | null;
	quota_mb: number;
	pending_quota_mb: number | null;
	size_bytes: number | null;
	usage_checked_at: string | null;
	projects: ProjectRef[];
	connection: Record<string, unknown> | null;
	last_failure: Record<string, unknown> | null;
	key_rotation: {
		status: string;
		requested_at: string;
		completed_at: string | null;
		failed_at: string | null;
		redeploy_attached: boolean;
		redeploys:
			{ project_id: string; deployment_id: string | null; skipped_reason: string | null }[] | null;
	} | null;
	created_at: string | null;
	updated_at: string | null;
};

/** The deployment the mock API queues for an attached project after a key rotation. */
export const KEY_ROTATION_DEPLOYMENT_ID = 'dep-key-rotation-1';

const MB = 1024 * 1024;
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const captured = capturedBucket<{ data: MockBucket }>('bucket-show').body.data;
export const BUCKET_ID = captured.id;

/** The project of project-detail.ts, the one the captured bucket is attached to. */
export const attachedProject = { id: PROJECT_ID, name: baseProject.name, slug: baseProject.slug };

export function readyBucket(overrides: Partial<MockBucket> = {}): MockBucket {
	return {
		...captured,
		name: 'unggahan-toko',
		projects: [attachedProject],
		usage_checked_at: minutesAgo(2),
		created_at: minutesAgo(60 * 24 * 3),
		...overrides
	};
}

export function spareBucket(): MockBucket {
	return readyBucket({
		id: 'bucket-spare',
		name: 'arsip-laporan',
		projects: [],
		quota_mb: 100,
		size_bytes: 92 * MB,
		connection: { ...captured.connection, bucket: 'b-arsip0000000000000000' },
		created_at: minutesAgo(60 * 24)
	});
}

export function provisioningBucket(): MockBucket {
	return {
		...capturedBucket<{ data: MockBucket }>('bucket-create').body.data,
		id: 'bucket-provisioning',
		name: 'galeri-foto',
		created_at: minutesAgo(1)
	};
}

export function unknownRotationBucket(): MockBucket {
	return {
		...capturedBucket<{ data: MockBucket }>('bucket-show-rotation-unknown').body.data,
		projects: [attachedProject]
	};
}

/** The project's attached bucket, as the project resource names it. */
export function projectBucket(overrides: Record<string, unknown> = {}) {
	return {
		id: BUCKET_ID,
		name: 'unggahan-toko',
		status: 'ready',
		region: 'jkt',
		variables: [
			'AWS_ENDPOINT_URL_S3',
			'AWS_ENDPOINT',
			'AWS_USE_PATH_STYLE_ENDPOINT',
			'AWS_REGION',
			'AWS_BUCKET',
			'AWS_ACCESS_KEY_ID',
			'AWS_SECRET_ACCESS_KEY'
		],
		overridden_variables: ['AWS_DEFAULT_REGION'],
		...overrides
	};
}

type JsonReply = { status?: number; body?: unknown };

export type BucketMockOptions = {
	buckets?: MockBucket[];
	role?: 'owner' | 'member' | 'viewer';
	quota?: { max_buckets: number; max_bucket_storage_mb: number };
	/** `buckets.available` on pilot-limits (default true); `null` leaves the key out (older API). */
	bucketsAvailable?: boolean | null;
	/** A new bucket turns ready after this many reads. */
	provisioningReads?: number;
	/** Answers POST .../buckets instead of the store, for refusals. */
	create?: (body: Record<string, unknown>) => JsonReply | undefined;
	credentials?: () => JsonReply | undefined;
	project?: Record<string, unknown>;
	envList?: unknown[];
};

function fulfill(route: Route, { status = 200, body }: JsonReply) {
	if (status === 204) return route.fulfill({ status });
	return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

export type BucketCalls = { method: string; path: string; body: unknown }[];

/**
 * The project mocks plus the bucket endpoints, answered from an in-memory store so a create,
 * attach, detach, quota change, rotation, or delete shows on the next read as the API would.
 */
export async function mockBucketApi(
	page: Page,
	options: BucketMockOptions = {}
): Promise<{ calls: BucketCalls; store: MockBucket[] }> {
	const store = options.buckets ?? [readyBucket(), spareBucket()];
	const calls: BucketCalls = [];
	const role = options.role ?? 'owner';
	const workspace = { ...TEAM_WORKSPACE, role };
	const quota = options.quota ?? { max_buckets: 3, max_bucket_storage_mb: 1024 };
	const reads = new Map<string, number>();

	await mockProjectApi(page, {
		project: () => ({
			...baseProject,
			workspace: {
				id: workspace.id,
				name: workspace.name,
				slug: workspace.slug,
				type: workspace.type
			},
			databases: [],
			buckets: store
				.filter((bucket) => bucket.projects.some((project) => project.id === PROJECT_ID))
				.map((bucket) =>
					projectBucket({ id: bucket.id, name: bucket.name, status: bucket.status })
				),
			...options.project
		}),
		envList: () => options.envList ?? []
	});

	await page.route(/\/api\/v1\/app\/workspaces(\?.*)?$/, (route) =>
		fulfill(route, {
			body: {
				data: [{ ...personalWorkspace, projects_count: 1, active_deployments_count: 0 }, workspace]
			}
		})
	);
	await page.addInitScript(([key, id]) => window.localStorage.setItem(key, id), [
		`sakala.active-workspace.1`,
		workspace.id
	] as const);
	await page.route('**/api/v1/app/notifications/unread-count', (route) =>
		fulfill(route, { body: { data: { count: 0 } } })
	);
	await page.route(/\/api\/v1\/app\/pilot-limits(\?.*)?$/, (route) => {
		const limits = capturedBucket<{
			data: Record<string, unknown> & { quotas: Record<string, unknown> };
		}>('pilot-limits-buckets').body.data;
		const counted = store.filter((bucket) => bucket.status !== 'failed');
		const data: Record<string, unknown> = {
			...limits,
			workspace_id: workspace.id,
			databases: { available: true },
			buckets: { available: options.bucketsAvailable ?? true, default_quota_mb: 256 },
			quotas: {
				...limits.quotas,
				max_buckets: quota.max_buckets,
				current_buckets_count: counted.length,
				max_bucket_storage_mb: quota.max_bucket_storage_mb,
				current_bucket_storage_mb: counted.reduce(
					(sum, bucket) => sum + Math.max(bucket.quota_mb, bucket.pending_quota_mb ?? 0),
					0
				),
				current_bucket_usage_bytes: counted.reduce(
					(sum, bucket) => sum + (bucket.size_bytes ?? 0),
					0
				)
			}
		};
		if (options.bucketsAvailable === null) {
			delete data.buckets;
			const quotas = data.quotas as Record<string, unknown>;
			for (const key of Object.keys(quotas)) if (key.includes('bucket')) delete quotas[key];
		}
		return fulfill(route, { body: { data } });
	});
	await page.route('**/api/v1/app/regions', (route) =>
		fulfill(route, { body: { data: [{ slug: 'jkt' }, { slug: 'sby' }] } })
	);
	await page.route(/\/api\/v1\/app\/projects(\?.*)?$/, (route) => {
		const url = new URL(route.request().url());
		const search = url.searchParams.get('search')?.toLowerCase() ?? '';
		const data = workspaceProjects
			.filter((project) => project.name.includes(search))
			.map((project) => ({
				...baseProject,
				id: project.id,
				name: project.name,
				slug: project.slug,
				public_url: `https://${project.slug}.sakala.app`,
				latest_deployment: null,
				databases: [],
				workspace: {
					id: workspace.id,
					name: workspace.name,
					slug: workspace.slug,
					type: workspace.type
				}
			}));
		return fulfill(route, {
			body: {
				data,
				links: { first: null, last: null, prev: null, next: null },
				meta: {
					current_page: 1,
					from: data.length ? 1 : null,
					last_page: 1,
					links: [],
					path: null,
					per_page: 6,
					to: data.length,
					total: data.length
				}
			}
		});
	});

	await page.route(/\/api\/v1\/app\/workspaces\/[^/]+\/buckets(\/.*)?$/, (route) => {
		const request = route.request();
		const method = request.method();
		const path = new URL(request.url()).pathname;
		const body = (request.postDataJSON() ?? null) as Record<string, unknown> | null;
		calls.push({ method, path, body });
		const [, bucketId, action, projectId] =
			path.match(/\/buckets(?:\/([^/]+))?(?:\/([^/]+))?(?:\/([^/]+))?$/) ?? [];
		const bucket = store.find((item) => item.id === bucketId);

		if (!bucketId) {
			if (method === 'POST') {
				const refused = options.create?.(body ?? {});
				if (refused) return fulfill(route, refused);
				const project = workspaceProjects.find((item) => item.id === body?.project_id);
				const created: MockBucket = {
					...capturedBucket<{ data: MockBucket }>('bucket-create').body.data,
					id: `bucket-new-${store.length}`,
					name: String(body?.name ?? project?.name),
					quota_mb: Number(body?.quota_mb ?? 256),
					region: (body?.region as string | null) ?? 'jkt',
					projects: project ? [project] : [],
					created_at: new Date().toISOString()
				};
				store.unshift(created);
				return fulfill(route, { status: 201, body: { data: created } });
			}
			return fulfill(route, { body: { data: store } });
		}
		if (!bucket) return fulfill(route, { status: 404, body: { message: 'Not found.' } });

		if (action === 'credentials') {
			const answer = options.credentials?.();
			if (answer) return fulfill(route, answer);
			if (role !== 'owner') return fulfill(route, capturedBucket('credentials-member'));
			return fulfill(route, capturedBucket('credentials'));
		}
		if (action === 'rotate-key') {
			bucket.key_rotation = {
				status: 'pending',
				requested_at: new Date().toISOString(),
				completed_at: null,
				failed_at: null,
				redeploy_attached: body?.redeploy_attached === true,
				redeploys: null
			};
			bucket.last_failure = null;
			reads.set(`rotation:${bucket.id}`, 0);
			return fulfill(route, { status: 202, body: { data: bucket } });
		}
		if (action === 'attachments' && projectId) {
			const project = workspaceProjects.find((item) => item.id === projectId)!;
			if (method === 'DELETE') {
				bucket.projects = bucket.projects.filter((item) => item.id !== projectId);
				return fulfill(route, { status: 204 });
			}
			bucket.projects = [...bucket.projects, project];
			return fulfill(route, {
				status: 201,
				body: {
					data: {
						bucket_id: bucket.id,
						project,
						redeploy_required: true,
						attached_at: new Date().toISOString()
					}
				}
			});
		}
		if (method === 'PATCH') {
			if (typeof body?.name === 'string') bucket.name = body.name;
			if (typeof body?.quota_mb === 'number') {
				bucket.pending_quota_mb = body.quota_mb;
				reads.set(`quota:${bucket.id}`, 0);
				return fulfill(route, { status: 202, body: { data: bucket } });
			}
			return fulfill(route, { body: { data: bucket } });
		}
		if (method === 'DELETE') {
			if (bucket.projects.length > 0) {
				return fulfill(route, {
					status: 409,
					body: {
						...capturedBucket<object>('bucket-delete-in-use').body,
						projects: bucket.projects
					}
				});
			}
			bucket.status = 'deleting';
			return fulfill(route, { status: 202, body: { data: bucket } });
		}

		// A rotation completes on the next read, and the attached project gets a redeploy.
		if (bucket.key_rotation?.status === 'pending') {
			bucket.key_rotation.status = 'completed';
			bucket.key_rotation.completed_at = new Date().toISOString();
			bucket.key_rotation.redeploys = bucket.key_rotation.redeploy_attached
				? bucket.projects.map((project) => ({
						project_id: project.id,
						deployment_id: KEY_ROTATION_DEPLOYMENT_ID,
						skipped_reason: null
					}))
				: null;
		}
		// A quota change lands on the next read.
		if (bucket.pending_quota_mb !== null) {
			bucket.quota_mb = bucket.pending_quota_mb;
			bucket.pending_quota_mb = null;
		}
		if (bucket.status === 'provisioning' && options.provisioningReads !== undefined) {
			const seen = (reads.get(bucket.id) ?? 0) + 1;
			reads.set(bucket.id, seen);
			if (seen > options.provisioningReads) {
				bucket.status = 'ready';
				bucket.size_bytes = 0;
				bucket.connection = { ...captured.connection };
				bucket.usage_checked_at = new Date().toISOString();
			}
		}
		return fulfill(route, { body: { data: bucket } });
	});

	return { calls, store };
}

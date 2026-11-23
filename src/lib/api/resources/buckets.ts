import { z } from 'zod';
import { apiRequest } from '../client';
import type { components } from '../generated/schema';

/*
 * Managed S3 buckets of a workspace (ADR-021, docs/API_CONVENTIONS.md "Bucket" in sakala-api). The
 * schemas satisfy the generated types and are checked against responses captured from the API in
 * tests/fixtures/buckets, the same way as databases.
 */

type GeneratedBucket = components['schemas']['BucketResource'];
type GeneratedAttachment = components['schemas']['BucketAttachmentResource'];
type GeneratedCredentials = components['schemas']['BucketCredentialsResource'];
type GeneratedKeyRotation = NonNullable<GeneratedBucket['key_rotation']>;

/** `deleted` never reaches the API's readers, so it is not one the Console shows. */
export const BUCKET_STATUSES = [
	'provisioning',
	'ready',
	'failed',
	'deleting',
	'locked'
] as const satisfies readonly GeneratedBucket['status'][];
export type KnownBucketStatus = (typeof BUCKET_STATUSES)[number];

/** Agent commands that `last_failure.command` names and the Console explains on its own. */
export const BUCKET_COMMANDS = {
	create: 'CreateBucket',
	rotateKey: 'RotateBucketKey',
	setQuota: 'SetBucketQuota'
} as const;

/**
 * `unknown` (sakala-api #204, contract section 13): the node could not confirm the new secret and
 * the API stopped resending it. Neither secret is known to work until a new rotation.
 */
export const KEY_ROTATION_STATUSES = [
	'pending',
	'completed',
	'failed',
	'unknown'
] as const satisfies readonly components['schemas']['BucketKeyRotationStatus'][];

const projectRefSchema = z.object({ id: z.string(), name: z.string(), slug: z.string() });
export type BucketProjectRef = z.output<typeof projectRefSchema>;

const lastFailureSchema = z.object({
	command: z.string(),
	code: z.string(),
	user_fixable: z.boolean(),
	/** Indonesian, written by the API for people. */
	summary: z.string(),
	failed_at: z.string().nullable()
});
export type BucketFailure = z.output<typeof lastFailureSchema>;

/** One attached project after a rotation that asked for redeploys. Reasons stay strings. */
const rotationRedeploySchema = z.object({
	project_id: z.string(),
	deployment_id: z.string().nullable(),
	skipped_reason: z.string().nullable()
});
export type BucketRotationRedeploy = z.output<typeof rotationRedeploySchema>;

/**
 * The newest key rotation. The node switches as soon as it runs the request, so the old secret can
 * stop working while `status` is still `pending`. The access key ID never changes.
 */
const keyRotationSchema = z.object({
	status: z.string(),
	requested_at: z.string(),
	completed_at: z.string().nullable(),
	failed_at: z.string().nullable(),
	redeploy_attached: z.boolean(),
	redeploys: z.array(rotationRedeploySchema).nullable()
});
export type BucketKeyRotation = z.output<typeof keyRotationSchema>;

/**
 * How applications reach the bucket, without the secret. Every member reads it: the endpoint is
 * public, and none of this is secret on its own.
 */
const connectionSchema = z.object({
	endpoint: z.string(),
	/** The S3 signing region, not the Sakala region of the node. */
	region: z.string(),
	bucket: z.string(),
	access_key_id: z.string(),
	path_style: z.boolean()
});
export type BucketConnection = z.output<typeof connectionSchema>;

/* `status` and `key_rotation.status` stay plain strings, so a value from a newer API still renders. */
const bucketSchema = z.object({
	id: z.string(),
	name: z.string(),
	status: z.string(),
	/** Sakala region of the storage node; `null` when that node has none. */
	region: z.string().nullable(),
	quota_mb: z.number(),
	/** A quota change on its way to the node; `null` when none is open. */
	pending_quota_mb: z.number().nullable(),
	size_bytes: z.number().nullable(),
	usage_checked_at: z.string().nullable(),
	projects: z.array(projectRefSchema),
	/** `null` unless the bucket is `ready` or `locked` and its node reported the endpoint. */
	connection: connectionSchema.nullable().default(null),
	last_failure: lastFailureSchema.nullable(),
	/** `null` when the key was never rotated. */
	key_rotation: keyRotationSchema.nullable().default(null),
	created_at: z.string().nullable(),
	updated_at: z.string().nullable()
}) satisfies z.ZodType<
	Omit<GeneratedBucket, 'status' | 'key_rotation'> & {
		status: string;
		key_rotation: (Omit<GeneratedKeyRotation, 'status'> & { status: string }) | null;
	},
	unknown
>;

export type Bucket = z.output<typeof bucketSchema>;

const attachmentSchema = z.object({
	bucket_id: z.string(),
	project: projectRefSchema,
	/** True while the project's serving deployment lacks the bucket variables. */
	redeploy_required: z.boolean(),
	attached_at: z.string().nullable()
}) satisfies z.ZodType<GeneratedAttachment>;

export type BucketAttachment = z.output<typeof attachmentSchema>;

const credentialsSchema = z.object({
	/** Public, `https://s3.` plus the projects domain; `null` until the storage node reports it. */
	endpoint: z.string().nullable(),
	region: z.string().nullable(),
	bucket: z.string(),
	access_key_id: z.string(),
	secret_access_key: z.string(),
	path_style: z.boolean(),
	/** Exactly what attached projects receive, in the API's order; `null` without an endpoint. */
	variables: z.record(z.string(), z.string()).nullable()
}) satisfies z.ZodType<GeneratedCredentials>;

export type BucketCredentials = z.output<typeof credentialsSchema>;

const bucketListSchema = z.object({ data: z.array(bucketSchema) });
const bucketResponseSchema = z.object({ data: bucketSchema });
const attachmentResponseSchema = z.object({ data: attachmentSchema });
const credentialsResponseSchema = z.object({ data: credentialsSchema });

export const parseBucketList = (response: unknown) => bucketListSchema.parse(response).data;
export const parseBucket = (response: unknown) => bucketResponseSchema.parse(response).data;
export const parseBucketAttachment = (response: unknown) =>
	attachmentResponseSchema.parse(response).data;
export const parseBucketCredentials = (response: unknown) =>
	credentialsResponseSchema.parse(response).data;

const segment = (value: string) => encodeURIComponent(value);
const bucketsPath = (workspaceId: string) =>
	`/api/v1/app/workspaces/${segment(workspaceId)}/buckets`;
const bucketPath = (workspaceId: string, bucketId: string) =>
	`${bucketsPath(workspaceId)}/${segment(bucketId)}`;

/** Newest first, without pagination: the workspace's quota keeps the list short. */
export async function listBuckets(workspaceId: string): Promise<Bucket[]> {
	return parseBucketList(await apiRequest<unknown>(bucketsPath(workspaceId)));
}

export async function getBucket(workspaceId: string, bucketId: string): Promise<Bucket> {
	return parseBucket(await apiRequest<unknown>(bucketPath(workspaceId, bucketId)));
}

type StoreBucketRequest = components['schemas']['StoreBucketRequest'];

export type CreateBucketPayload = Pick<StoreBucketRequest, 'name' | 'region' | 'quota_mb'>;

/**
 * A bucket made for one project: attached in the same transaction, named after the project when
 * `name` is empty. Without `deploy_when_ready` (phase 2), so the project deploys once it is ready.
 */
export type CreateProjectBucketPayload = Pick<
	StoreBucketRequest,
	'name' | 'region' | 'quota_mb'
> & {
	project_id: string;
};

/** `201`, `provisioning` until the storage node creates it; the quota is reserved at once. */
export async function createBucket(
	workspaceId: string,
	payload: CreateBucketPayload
): Promise<Bucket> {
	return parseBucket(
		await apiRequest<unknown>(bucketsPath(workspaceId), { method: 'POST', json: payload })
	);
}

/** `201`, attached to the project already. `BUCKET_UNAVAILABLE` when no storage server takes it. */
export async function createProjectBucket(
	workspaceId: string,
	payload: CreateProjectBucketPayload
): Promise<Bucket> {
	return parseBucket(
		await apiRequest<unknown>(bucketsPath(workspaceId), { method: 'POST', json: payload })
	);
}

export type UpdateBucketPayload = components['schemas']['UpdateBucketRequest'];

/** `200` for a rename, `202` with `pending_quota_mb` when the node has a quota change to apply. */
export async function updateBucket(
	workspaceId: string,
	bucketId: string,
	payload: UpdateBucketPayload
): Promise<Bucket> {
	return parseBucket(
		await apiRequest<unknown>(bucketPath(workspaceId, bucketId), { method: 'PATCH', json: payload })
	);
}

/**
 * `202` with `status: deleting`, or `204` when a bucket still waiting for the node was removed
 * before it was created. `null` then: there is nothing left to show.
 */
export async function deleteBucket(workspaceId: string, bucketId: string): Promise<Bucket | null> {
	const response = await apiRequest<unknown>(bucketPath(workspaceId, bucketId), {
		method: 'DELETE'
	});
	return response == null ? null : parseBucket(response);
}

/** `201`, or `200` when it was attached already. The project receives the variables on its next deploy. */
export async function attachBucket(
	workspaceId: string,
	bucketId: string,
	projectId: string
): Promise<BucketAttachment> {
	return parseBucketAttachment(
		await apiRequest<unknown>(
			`${bucketPath(workspaceId, bucketId)}/attachments/${segment(projectId)}`,
			{ method: 'POST' }
		)
	);
}

/** `204`. The files stay; the project loses the variables on its next deploy. */
export async function detachBucket(
	workspaceId: string,
	bucketId: string,
	projectId: string
): Promise<void> {
	await apiRequest<void>(`${bucketPath(workspaceId, bucketId)}/attachments/${segment(projectId)}`, {
		method: 'DELETE'
	});
}

/**
 * Owners of the workspace and admins only. Every read is written to the audit trail before the
 * secret is sent, so the Console reads it only when someone asks, never caches it, and the API
 * answers `Cache-Control: no-store`.
 */
export async function revealBucketCredentials(
	workspaceId: string,
	bucketId: string
): Promise<BucketCredentials> {
	return parseBucketCredentials(
		await apiRequest<unknown>(`${bucketPath(workspaceId, bucketId)}/credentials`, {
			cache: 'no-store'
		})
	);
}

export type RotateBucketKeyPayload = Required<components['schemas']['RotateBucketKeyRequest']>;

/**
 * `202` with `key_rotation.status: pending`. The node stops accepting the old secret as soon as it
 * runs the request; with `redeploy_attached` the API then redeploys the attached projects.
 */
export async function rotateBucketKey(
	workspaceId: string,
	bucketId: string,
	payload: RotateBucketKeyPayload
): Promise<Bucket> {
	return parseBucket(
		await apiRequest<unknown>(`${bucketPath(workspaceId, bucketId)}/rotate-key`, {
			method: 'POST',
			json: payload
		})
	);
}

import { createMutation, useQueryClient, type QueryClient } from '@tanstack/svelte-query';
import { queryKeys } from '$lib/api/query-keys';
import {
	attachBucket,
	createBucket,
	createProjectBucket,
	deleteBucket,
	detachBucket,
	revealBucketCredentials,
	rotateBucketKey,
	updateBucket,
	type Bucket,
	type CreateBucketPayload,
	type CreateProjectBucketPayload,
	type UpdateBucketPayload
} from '$lib/api/resources/buckets';

type Target = { workspaceId: string; bucketId: string };

/** The answer is the bucket as it is now, so the detail shows it without another read. */
function storeBucket(client: QueryClient, workspaceId: string, bucket: Bucket) {
	client.setQueryData(queryKeys.workspaces.bucket(workspaceId, bucket.id), bucket);
	void client.invalidateQueries({ queryKey: queryKeys.workspaces.buckets(workspaceId) });
}

/** Counts and allocation come from pilot-limits, and project resources name the attached bucket. */
function refreshAround(client: QueryClient, workspaceId: string) {
	void client.invalidateQueries({ queryKey: queryKeys.workspaces.buckets(workspaceId) });
	void client.invalidateQueries({ queryKey: queryKeys.pilotLimits });
	void client.invalidateQueries({ queryKey: queryKeys.projects.all });
}

export function createCreateBucketMutation() {
	const client = useQueryClient();
	return createMutation(() => ({
		mutationFn: ({
			workspaceId,
			payload
		}: {
			workspaceId: string;
			payload: CreateBucketPayload | CreateProjectBucketPayload;
		}) =>
			'project_id' in payload
				? createProjectBucket(workspaceId, payload)
				: createBucket(workspaceId, payload),
		onSuccess: (bucket, { workspaceId }) => {
			client.setQueryData(queryKeys.workspaces.bucket(workspaceId, bucket.id), bucket);
			refreshAround(client, workspaceId);
		}
	}));
}

/** Rename and quota share one endpoint; a quota change also moves the workspace's allocation. */
export function createUpdateBucketMutation() {
	const client = useQueryClient();
	return createMutation(() => ({
		mutationFn: ({ workspaceId, bucketId, payload }: Target & { payload: UpdateBucketPayload }) =>
			updateBucket(workspaceId, bucketId, payload),
		onSuccess: (bucket, { workspaceId, payload }) => {
			storeBucket(client, workspaceId, bucket);
			if (payload.quota_mb !== undefined) {
				void client.invalidateQueries({ queryKey: queryKeys.pilotLimits });
			}
			if (payload.name !== undefined) {
				void client.invalidateQueries({ queryKey: queryKeys.projects.all });
			}
		}
	}));
}

export function createDeleteBucketMutation() {
	const client = useQueryClient();
	return createMutation(() => ({
		mutationFn: ({ workspaceId, bucketId }: Target) => deleteBucket(workspaceId, bucketId),
		onSuccess: (bucket, { workspaceId, bucketId }) => {
			if (bucket) client.setQueryData(queryKeys.workspaces.bucket(workspaceId, bucket.id), bucket);
			else client.removeQueries({ queryKey: queryKeys.workspaces.bucket(workspaceId, bucketId) });
			refreshAround(client, workspaceId);
		}
	}));
}

export function createAttachBucketMutation() {
	const client = useQueryClient();
	return createMutation(() => ({
		mutationFn: ({ workspaceId, bucketId, projectId }: Target & { projectId: string }) =>
			attachBucket(workspaceId, bucketId, projectId),
		onSuccess: (_attachment, { workspaceId }) => refreshAround(client, workspaceId)
	}));
}

export function createDetachBucketMutation() {
	const client = useQueryClient();
	return createMutation(() => ({
		mutationFn: ({ workspaceId, bucketId, projectId }: Target & { projectId: string }) =>
			detachBucket(workspaceId, bucketId, projectId),
		// A 404 means it was detached already, so the list is stale either way.
		onSettled: (_result, _error, { workspaceId }) => refreshAround(client, workspaceId)
	}));
}

export function createRotateBucketKeyMutation() {
	const client = useQueryClient();
	return createMutation(() => ({
		mutationFn: ({
			workspaceId,
			bucketId,
			redeployAttached
		}: Target & { redeployAttached: boolean }) =>
			rotateBucketKey(workspaceId, bucketId, { redeploy_attached: redeployAttached }),
		onSuccess: (bucket, { workspaceId }) => storeBucket(client, workspaceId, bucket)
	}));
}

/**
 * A mutation, not a query: every read is audited, so it runs only when the owner presses
 * Tampilkan, and the secret never enters the query cache. `gcTime: 0` drops the mutation's own
 * copy as soon as the component that asked is gone.
 */
export function createRevealBucketCredentialsMutation() {
	return createMutation(() => ({
		mutationFn: ({ workspaceId, bucketId }: Target) =>
			revealBucketCredentials(workspaceId, bucketId),
		gcTime: 0
	}));
}

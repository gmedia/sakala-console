import { createMutation, useQueryClient, type QueryClient } from '@tanstack/svelte-query';
import { queryKeys } from '$lib/api/query-keys';
import {
	attachValkey,
	createValkey,
	deleteValkey,
	detachValkey,
	revealValkeyCredentials,
	rotateValkeyPassword,
	updateValkey,
	type CreateValkeyPayload,
	type UpdateValkeyPayload,
	type Valkey
} from '$lib/api/resources/valkeys';

type Target = { workspaceId: string; valkeyId: string };

/** The answer is the store as it is now, so the detail shows it without another read. */
function storeValkey(client: QueryClient, workspaceId: string, valkey: Valkey) {
	client.setQueryData(queryKeys.workspaces.valkey(workspaceId, valkey.id), valkey);
	void client.invalidateQueries({ queryKey: queryKeys.workspaces.valkeys(workspaceId) });
}

/** Counts and reserved memory come from pilot-limits, and project resources name the store. */
function refreshAround(client: QueryClient, workspaceId: string) {
	void client.invalidateQueries({ queryKey: queryKeys.workspaces.valkeys(workspaceId) });
	void client.invalidateQueries({ queryKey: queryKeys.pilotLimits });
	void client.invalidateQueries({ queryKey: queryKeys.projects.all });
}

export function createCreateValkeyMutation() {
	const client = useQueryClient();
	return createMutation(() => ({
		mutationFn: ({ workspaceId, payload }: { workspaceId: string; payload: CreateValkeyPayload }) =>
			createValkey(workspaceId, payload),
		onSuccess: (valkey, { workspaceId }) => {
			client.setQueryData(queryKeys.workspaces.valkey(workspaceId, valkey.id), valkey);
			refreshAround(client, workspaceId);
		}
	}));
}

/** Rename and resize share one endpoint; a resize also moves the workspace's reserved memory. */
export function createUpdateValkeyMutation() {
	const client = useQueryClient();
	return createMutation(() => ({
		mutationFn: ({ workspaceId, valkeyId, payload }: Target & { payload: UpdateValkeyPayload }) =>
			updateValkey(workspaceId, valkeyId, payload),
		onSuccess: (valkey, { workspaceId, payload }) => {
			storeValkey(client, workspaceId, valkey);
			if (payload.maxmemory_mb !== undefined) {
				void client.invalidateQueries({ queryKey: queryKeys.pilotLimits });
			}
			if (payload.name !== undefined) {
				void client.invalidateQueries({ queryKey: queryKeys.projects.all });
			}
		}
	}));
}

export function createDeleteValkeyMutation() {
	const client = useQueryClient();
	return createMutation(() => ({
		mutationFn: ({ workspaceId, valkeyId }: Target) => deleteValkey(workspaceId, valkeyId),
		onSuccess: (valkey, { workspaceId, valkeyId }) => {
			if (valkey) client.setQueryData(queryKeys.workspaces.valkey(workspaceId, valkey.id), valkey);
			else client.removeQueries({ queryKey: queryKeys.workspaces.valkey(workspaceId, valkeyId) });
			refreshAround(client, workspaceId);
		}
	}));
}

export function createAttachValkeyMutation() {
	const client = useQueryClient();
	return createMutation(() => ({
		mutationFn: ({ workspaceId, valkeyId, projectId }: Target & { projectId: string }) =>
			attachValkey(workspaceId, valkeyId, projectId),
		onSuccess: (_attachment, { workspaceId }) => refreshAround(client, workspaceId)
	}));
}

export function createDetachValkeyMutation() {
	const client = useQueryClient();
	return createMutation(() => ({
		mutationFn: ({ workspaceId, valkeyId, projectId }: Target & { projectId: string }) =>
			detachValkey(workspaceId, valkeyId, projectId),
		// A 404 means it was detached already, so the list is stale either way.
		onSettled: (_result, _error, { workspaceId }) => refreshAround(client, workspaceId)
	}));
}

export function createRotateValkeyPasswordMutation() {
	const client = useQueryClient();
	return createMutation(() => ({
		mutationFn: ({
			workspaceId,
			valkeyId,
			redeployAttached
		}: Target & { redeployAttached: boolean }) =>
			rotateValkeyPassword(workspaceId, valkeyId, { redeploy_attached: redeployAttached }),
		onSuccess: (valkey, { workspaceId }) => storeValkey(client, workspaceId, valkey)
	}));
}

/**
 * A mutation, not a query: every read is audited, so it runs only when the owner presses
 * Tampilkan, and the password never enters the query cache. `gcTime: 0` drops the mutation's own
 * copy as soon as the component that asked is gone.
 */
export function createRevealValkeyCredentialsMutation() {
	return createMutation(() => ({
		mutationFn: ({ workspaceId, valkeyId }: Target) =>
			revealValkeyCredentials(workspaceId, valkeyId),
		gcTime: 0
	}));
}

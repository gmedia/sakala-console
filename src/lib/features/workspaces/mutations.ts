import { createMutation, useQueryClient } from '@tanstack/svelte-query';
import { queryKeys } from '$lib/api/query-keys';
import {
	acceptWorkspaceInvitation,
	createWorkspace,
	declineWorkspaceInvitation,
	deleteWorkspace,
	inviteToWorkspace,
	leaveWorkspace,
	removeWorkspaceMember,
	renameWorkspace,
	revokeWorkspaceInvitation,
	updateWorkspaceMemberRole,
	type Workspace,
	type WorkspaceRole
} from '$lib/api/resources/workspaces';

/*
 * A membership change can move projects in or out of view and change what the caller may do,
 * so those mutations refresh the workspace list, the project lists, and the limits together.
 */
/** The new workspace goes into the list at once, so selecting it does not fall back first. */
function addToList(client: ReturnType<typeof useQueryClient>, workspace: Workspace) {
	client.setQueryData<Workspace[]>(queryKeys.workspaces.list, (current) =>
		current && !current.some((item) => item.id === workspace.id) ? [...current, workspace] : current
	);
}

function invalidateMembership(client: ReturnType<typeof useQueryClient>) {
	void client.invalidateQueries({ queryKey: queryKeys.workspaces.all });
	void client.invalidateQueries({ queryKey: queryKeys.projects.all });
	void client.invalidateQueries({ queryKey: queryKeys.pilotLimits });
}

export function createCreateWorkspaceMutation() {
	const client = useQueryClient();
	return createMutation(() => ({
		mutationFn: (name: string) => createWorkspace(name),
		onSuccess: (workspace) => {
			addToList(client, workspace);
			void client.invalidateQueries({ queryKey: queryKeys.workspaces.list });
		}
	}));
}

export function createRenameWorkspaceMutation() {
	const client = useQueryClient();
	return createMutation(() => ({
		mutationFn: ({ workspaceId, name }: { workspaceId: string; name: string }) =>
			renameWorkspace(workspaceId, name),
		onSuccess: () => {
			void client.invalidateQueries({ queryKey: queryKeys.workspaces.list });
			// Project cards and headers carry the workspace name.
			void client.invalidateQueries({ queryKey: queryKeys.projects.all });
		}
	}));
}

export function createDeleteWorkspaceMutation() {
	const client = useQueryClient();
	return createMutation(() => ({
		mutationFn: (workspaceId: string) => deleteWorkspace(workspaceId),
		onSuccess: () => invalidateMembership(client)
	}));
}

export function createLeaveWorkspaceMutation() {
	const client = useQueryClient();
	return createMutation(() => ({
		mutationFn: (workspaceId: string) => leaveWorkspace(workspaceId),
		onSuccess: () => invalidateMembership(client)
	}));
}

export function createInviteMutation(workspaceId: () => string) {
	const client = useQueryClient();
	return createMutation(() => ({
		mutationFn: (payload: { email: string; role: WorkspaceRole }) =>
			inviteToWorkspace(workspaceId(), payload),
		onSuccess: () =>
			client.invalidateQueries({ queryKey: queryKeys.workspaces.invitations(workspaceId()) })
	}));
}

export function createRevokeInvitationMutation(workspaceId: () => string) {
	const client = useQueryClient();
	return createMutation(() => ({
		mutationFn: (invitationId: string) => revokeWorkspaceInvitation(workspaceId(), invitationId),
		onSettled: () =>
			client.invalidateQueries({ queryKey: queryKeys.workspaces.invitations(workspaceId()) })
	}));
}

export function createChangeRoleMutation(workspaceId: () => string) {
	const client = useQueryClient();
	return createMutation(() => ({
		mutationFn: ({ memberId, role }: { memberId: string; role: WorkspaceRole }) =>
			updateWorkspaceMemberRole(workspaceId(), memberId, role),
		// The caller may have changed their own role.
		onSettled: () => invalidateMembership(client)
	}));
}

export function createRemoveMemberMutation(workspaceId: () => string) {
	const client = useQueryClient();
	return createMutation(() => ({
		mutationFn: (memberId: string) => removeWorkspaceMember(workspaceId(), memberId),
		onSettled: () => invalidateMembership(client)
	}));
}

export function createAcceptInvitationMutation() {
	const client = useQueryClient();
	return createMutation(() => ({
		mutationFn: ({ invitationId, token }: { invitationId: string; token?: string }) =>
			acceptWorkspaceInvitation(invitationId, token),
		onSuccess: (workspace) => {
			addToList(client, workspace);
			invalidateMembership(client);
		},
		// A used, revoked, or expired invitation drops out of the list either way.
		onError: () => client.invalidateQueries({ queryKey: queryKeys.workspaces.myInvitations })
	}));
}

export function createDeclineInvitationMutation() {
	const client = useQueryClient();
	return createMutation(() => ({
		mutationFn: ({ invitationId, token }: { invitationId: string; token?: string }) =>
			declineWorkspaceInvitation(invitationId, token),
		onSettled: () => client.invalidateQueries({ queryKey: queryKeys.workspaces.myInvitations })
	}));
}

import { createQuery } from '@tanstack/svelte-query';
import { queryKeys } from '$lib/api/query-keys';
import { getPilotLimits } from '$lib/api/resources/pilot-limits';
import {
	getWorkspaceInvitation,
	listMyInvitations,
	listWorkspaceInvitations,
	listWorkspaceMembers,
	listWorkspaces
} from '$lib/api/resources/workspaces';

export function createWorkspacesQuery(options: () => { enabled?: boolean } = () => ({})) {
	return createQuery(() => ({
		queryKey: queryKeys.workspaces.list,
		queryFn: listWorkspaces,
		staleTime: 60_000,
		enabled: options().enabled ?? true
	}));
}

export function createWorkspaceMembersQuery(workspaceId: () => string | null) {
	return createQuery(() => {
		const id = workspaceId();
		return {
			queryKey: queryKeys.workspaces.members(id ?? ''),
			queryFn: () => listWorkspaceMembers(id ?? ''),
			enabled: Boolean(id)
		};
	});
}

/** Owners only: the API refuses everyone else, so the query waits until the role is known. */
export function createWorkspaceInvitationsQuery(
	workspaceId: () => string | null,
	enabled: () => boolean
) {
	return createQuery(() => {
		const id = workspaceId();
		return {
			queryKey: queryKeys.workspaces.invitations(id ?? ''),
			queryFn: () => listWorkspaceInvitations(id ?? ''),
			enabled: Boolean(id) && enabled()
		};
	});
}

export function createMyInvitationsQuery() {
	return createQuery(() => ({
		queryKey: queryKeys.workspaces.myInvitations,
		queryFn: listMyInvitations
	}));
}

/**
 * The invitation behind a link. Read once: the API shares a rate limit of 5 a minute between this
 * read, accept, and decline, and a 404 or 409 will not change on a second try.
 */
export function createInvitationDetailsQuery(
	invitationId: () => string,
	token: () => string | null
) {
	return createQuery(() => {
		const id = invitationId();
		const linkToken = token();
		return {
			queryKey: queryKeys.workspaceInvitation(id, linkToken),
			queryFn: () => getWorkspaceInvitation(id, linkToken ?? undefined),
			enabled: Boolean(id),
			retry: false,
			staleTime: Infinity,
			refetchOnWindowFocus: false,
			refetchOnReconnect: false
		};
	});
}

/** `null` asks for the personal workspace, which the API answers without a parameter. */
export function createWorkspaceLimitsQuery(
	workspaceId: () => string | null,
	options: () => { enabled?: boolean } = () => ({})
) {
	return createQuery(() => {
		const id = workspaceId();
		return {
			queryKey: queryKeys.workspaces.limits(id),
			queryFn: () => getPilotLimits(id),
			retry: false,
			enabled: options().enabled ?? true
		};
	});
}

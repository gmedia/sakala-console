import type { QueryClient } from '@tanstack/svelte-query';
import { queryKeys, workspaceIdOfQueryKey } from '$lib/api/query-keys';
import type { CurrentUser } from '$lib/api/resources/auth';
import type { Workspace } from '$lib/api/resources/workspaces';
import { workspaceSelection } from './selection.svelte';

/**
 * Forgets a workspace the user no longer belongs to: they left it, deleted it, or someone removed
 * them. Afterwards nothing in the cache asks the API about it again, and the personal workspace is
 * the active one, here and in the remembered choice.
 *
 * Order matters. The workspace leaves the cached list first, so a page still showing it disables
 * its member, invitation, and limit reads before anything could refetch them. Those reads are then
 * cancelled and removed, never invalidated: invalidating them is what asked the API for a
 * workspace that was gone. Only reads that span workspaces are refreshed.
 *
 * Returns the workspace as the cache knew it, or `undefined` if the cache never had it.
 */
export function forgetWorkspace(client: QueryClient, workspaceId: string): Workspace | undefined {
	const known = client.getQueryData<Workspace[]>(queryKeys.workspaces.list);
	const forgotten = known?.find((workspace) => workspace.id === workspaceId);
	if (known) {
		client.setQueryData<Workspace[]>(
			queryKeys.workspaces.list,
			known.filter((workspace) => workspace.id !== workspaceId)
		);
	}

	const userId = client.getQueryData<CurrentUser>(queryKeys.auth.currentUser)?.id;
	const personal = known?.find((workspace) => workspace.type === 'personal');
	workspaceSelection.select(userId, personal?.id ?? null);

	const scoped = {
		predicate: (query: { queryKey: readonly unknown[] }) =>
			workspaceIdOfQueryKey(query.queryKey) === workspaceId
	};
	void client.cancelQueries(scoped);
	client.removeQueries(scoped);

	void client.invalidateQueries({ queryKey: queryKeys.workspaces.list });
	void client.invalidateQueries({ queryKey: queryKeys.projects.all });
	void client.invalidateQueries({ queryKey: queryKeys.pilotLimits });

	return forgotten;
}

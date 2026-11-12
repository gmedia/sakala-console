import { hashKey, type QueryClient } from '@tanstack/svelte-query';
import { queryKeys } from '$lib/api/query-keys';
import { listWorkspaces, type Workspace } from '$lib/api/resources/workspaces';
import { forgetWorkspace } from './forget';

export type WorkspaceAccessLostEffects = {
	/** Tells the user, by the workspace's name. */
	notify: (workspace: Workspace) => void;
	/** Leaves a page that only made sense inside the workspace. */
	leave: (workspaceId: string) => void;
};

/**
 * Handles a 403, 404, or 422 on a read about one workspace (see `reportWorkspaceQueryError`). The
 * workspace list decides: when the workspace is no longer in it, someone removed the user or
 * deleted the team, so the Console forgets it, says so once, and moves to the personal workspace.
 * When it is still there, the error belongs to the screen (a role change, for one), and the fresh
 * list already updated what the user may do.
 *
 * One check per workspace at a time, and the forgotten reads are removed rather than refetched,
 * so a burst of failing reads cannot turn into a loop.
 */
export function createWorkspaceAccessLostHandler(
	client: QueryClient,
	effects: WorkspaceAccessLostEffects
) {
	const checking = new Set<string>();

	// Workspaces the list has shown in this session, so the message can name one that a refreshed
	// list already dropped. Forgotten with the list itself, which happens when the session ends.
	const seen = new Map<string, Workspace>();
	const remember = (list: Workspace[] | undefined) =>
		list?.forEach((workspace) => seen.set(workspace.id, workspace));
	const listHash = hashKey(queryKeys.workspaces.list);
	remember(client.getQueryData<Workspace[]>(queryKeys.workspaces.list));
	client.getQueryCache().subscribe((event) => {
		if (event.query.queryHash !== listHash) return;
		if (event.type === 'removed') seen.clear();
		else remember(event.query.state.data as Workspace[] | undefined);
	});

	return async function handleWorkspaceAccessLost(workspaceId: string): Promise<void> {
		if (checking.has(workspaceId)) return;
		checking.add(workspaceId);
		try {
			const current = await client.fetchQuery({
				queryKey: queryKeys.workspaces.list,
				queryFn: listWorkspaces,
				staleTime: 0
			});
			if (current.some((workspace) => workspace.id === workspaceId)) return;
			forgetWorkspace(client, workspaceId);
			const known = seen.get(workspaceId);
			if (known) effects.notify(known);
			effects.leave(workspaceId);
		} catch {
			// The list cannot be read either; the screen shows its own error and nothing is forgotten.
		} finally {
			checking.delete(workspaceId);
		}
	};
}

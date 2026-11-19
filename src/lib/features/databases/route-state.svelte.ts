import { page } from '$app/state';
import { useActiveWorkspace } from '$lib/features/workspaces/access.svelte';
import { createDatabaseQuery } from './queries';
import { DATABASE_PROJECT_PARAM, DATABASE_WORKSPACE_PARAM } from './routes';

/**
 * The database page's workspace and name. The workspace comes from the link, which always carries
 * it, or the active workspace for a link typed by hand. The name is read from the same cached query
 * the page uses, so the header and the title cost no extra request.
 */
export function useDatabaseRoute() {
	const workspaces = useActiveWorkspace();
	const workspaceId = $derived(
		page.url.searchParams.get(DATABASE_WORKSPACE_PARAM) || workspaces.active?.id || null
	);
	const databaseId = $derived(page.params.databaseId ?? '');
	const query = createDatabaseQuery(
		() => (databaseId ? workspaceId : null),
		() => databaseId
	);

	return {
		get workspaceId() {
			return workspaceId;
		},
		get databaseId() {
			return databaseId;
		},
		/** A project the user came from, preselected when attaching. */
		get projectId() {
			return page.url.searchParams.get(DATABASE_PROJECT_PARAM);
		},
		get name() {
			return query.data?.name ?? null;
		}
	};
}

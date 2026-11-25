import { page } from '$app/state';
import { useActiveWorkspace } from '$lib/features/workspaces/access.svelte';
import { createValkeyQuery } from './queries';
import { VALKEY_PROJECT_PARAM, VALKEY_WORKSPACE_PARAM } from './routes';

/**
 * The store page's workspace and name, like the bucket page: the workspace from the link, or the
 * active one for a link typed by hand, and the name from the same cached query the page uses.
 */
export function useValkeyRoute() {
	const workspaces = useActiveWorkspace();
	const workspaceId = $derived(
		page.url.searchParams.get(VALKEY_WORKSPACE_PARAM) || workspaces.active?.id || null
	);
	const valkeyId = $derived(page.params.valkeyId ?? '');
	const query = createValkeyQuery(
		() => (valkeyId ? workspaceId : null),
		() => valkeyId
	);

	return {
		get workspaceId() {
			return workspaceId;
		},
		get valkeyId() {
			return valkeyId;
		},
		/** A project the user came from, preselected when attaching. */
		get projectId() {
			return page.url.searchParams.get(VALKEY_PROJECT_PARAM);
		},
		get name() {
			return query.data?.name ?? null;
		}
	};
}

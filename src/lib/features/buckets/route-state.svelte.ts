import { page } from '$app/state';
import { useActiveWorkspace } from '$lib/features/workspaces/access.svelte';
import { createBucketQuery } from './queries';
import { BUCKET_PROJECT_PARAM, BUCKET_WORKSPACE_PARAM } from './routes';

/**
 * The bucket page's workspace and name, like the database page: the workspace from the link, or
 * the active one for a link typed by hand, and the name from the same cached query the page uses.
 */
export function useBucketRoute() {
	const workspaces = useActiveWorkspace();
	const workspaceId = $derived(
		page.url.searchParams.get(BUCKET_WORKSPACE_PARAM) || workspaces.active?.id || null
	);
	const bucketId = $derived(page.params.bucketId ?? '');
	const query = createBucketQuery(
		() => (bucketId ? workspaceId : null),
		() => bucketId
	);

	return {
		get workspaceId() {
			return workspaceId;
		},
		get bucketId() {
			return bucketId;
		},
		/** A project the user came from, preselected when attaching. */
		get projectId() {
			return page.url.searchParams.get(BUCKET_PROJECT_PARAM);
		},
		get name() {
			return query.data?.name ?? null;
		}
	};
}

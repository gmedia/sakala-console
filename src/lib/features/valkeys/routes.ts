import { resolveRoute } from '$app/paths';

/** The query parameter that names the store's workspace; the API scopes stores by it. */
export const VALKEY_WORKSPACE_PARAM = 'workspace';
/** The project the user came from: preselected when attaching, the target when creating. */
export const VALKEY_PROJECT_PARAM = 'project';

function withProject(base: string, projectId?: string): string {
	return projectId ? `${base}?${new URLSearchParams({ [VALKEY_PROJECT_PARAM]: projectId })}` : base;
}

export function valkeysHref(params: { projectId?: string } = {}): string {
	return withProject(resolveRoute('/(app)/valkeys'), params.projectId);
}

/** The create page; with a project, the new store is attached to it in the same step. */
export function newValkeyHref(params: { projectId?: string } = {}): string {
	return withProject(resolveRoute('/(app)/valkeys/new'), params.projectId);
}

/** A store's page, with its workspace in the query string like a bucket page. */
export function valkeyHref(
	workspaceId: string,
	valkeyId: string,
	params: { projectId?: string } = {}
): string {
	const search = new URLSearchParams({ [VALKEY_WORKSPACE_PARAM]: workspaceId });
	if (params.projectId) search.set(VALKEY_PROJECT_PARAM, params.projectId);
	return `${resolveRoute('/(app)/valkeys/[valkeyId]', { valkeyId })}?${search}`;
}

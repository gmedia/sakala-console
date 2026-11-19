import { resolveRoute } from '$app/paths';

/** The query parameter that names the database's workspace; the API scopes databases by it. */
export const DATABASE_WORKSPACE_PARAM = 'workspace';
/** On the list page: open the create dialog for this project, with its region preselected. */
export const DATABASE_PROJECT_PARAM = 'project';

export function databasesHref(params: { projectId?: string } = {}): string {
	const base = resolveRoute('/(app)/databases');
	return params.projectId
		? `${base}?${new URLSearchParams({ [DATABASE_PROJECT_PARAM]: params.projectId })}`
		: base;
}

/**
 * A database page. The workspace travels in the query string because the API scopes the database
 * by it, and the database may belong to a workspace other than the active one.
 */
export function databaseHref(
	workspaceId: string,
	databaseId: string,
	params: { projectId?: string } = {}
): string {
	const search = new URLSearchParams({ [DATABASE_WORKSPACE_PARAM]: workspaceId });
	if (params.projectId) search.set(DATABASE_PROJECT_PARAM, params.projectId);
	return `${resolveRoute('/(app)/databases/[databaseId]', { databaseId })}?${search}`;
}

/** Where a project is redeployed after a database change: its variables tab shows the notice. */
export function projectVariablesHref(projectId: string): string {
	return resolveRoute('/(app)/projects/[id]/environments', { id: projectId });
}

export function projectHref(projectId: string): string {
	return resolveRoute('/(app)/projects/[id]', { id: projectId });
}

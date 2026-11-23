import { resolveRoute } from '$app/paths';

/** The query parameter that names the bucket's workspace; the API scopes buckets by it. */
export const BUCKET_WORKSPACE_PARAM = 'workspace';
/** On the list page: open the create dialog for this project, which the new bucket is attached to. */
export const BUCKET_PROJECT_PARAM = 'project';

export function bucketsHref(params: { projectId?: string } = {}): string {
	const base = resolveRoute('/(app)/buckets');
	return params.projectId
		? `${base}?${new URLSearchParams({ [BUCKET_PROJECT_PARAM]: params.projectId })}`
		: base;
}

/** A bucket page, with its workspace in the query string like a database page. */
export function bucketHref(
	workspaceId: string,
	bucketId: string,
	params: { projectId?: string } = {}
): string {
	const search = new URLSearchParams({ [BUCKET_WORKSPACE_PARAM]: workspaceId });
	if (params.projectId) search.set(BUCKET_PROJECT_PARAM, params.projectId);
	return `${resolveRoute('/(app)/buckets/[bucketId]', { bucketId })}?${search}`;
}

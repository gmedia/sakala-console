import { z } from 'zod';

const uuid = z.uuid();

function readUuid(value: string | null | undefined): string | null {
	return value && uuid.safeParse(value).success ? value : null;
}

/** Link to the feedback form, carrying what the user was looking at. */
export function feedbackPath(
	base: string,
	context: { projectId?: string | null; deploymentId?: string | null } = {}
): string {
	const params = new URLSearchParams();
	const projectId = readUuid(context.projectId);
	const deploymentId = readUuid(context.deploymentId);
	if (projectId) params.set('project', projectId);
	if (projectId && deploymentId) params.set('deployment', deploymentId);
	const query = params.toString();
	return query ? `${base}?${query}` : base;
}

/** The API validates both ids as UUIDs, and anything else in the URL is not context. */
export function readFeedbackContext(params: URLSearchParams): {
	projectId: string | null;
	deploymentId: string | null;
} {
	const projectId = readUuid(params.get('project'));
	return {
		projectId,
		deploymentId: projectId ? readUuid(params.get('deployment')) : null
	};
}

import type { Notification } from '$lib/api/resources/notifications';

/** Where a notification leads. Account notifications have no page of their own. */
export function notificationHref(
	notification: Pick<Notification, 'project_id' | 'deployment_id'>
): string | null {
	const { project_id: projectId, deployment_id: deploymentId } = notification;
	if (projectId && deploymentId) return `/projects/${projectId}/deployments/${deploymentId}`;
	if (projectId) return `/projects/${projectId}`;
	return null;
}

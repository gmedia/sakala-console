import type { Notification } from '$lib/api/resources/notifications';

/**
 * Where a notification leads. Account notifications have no page of their own. A workspace
 * notification is an invitation, and it carries no invitation ID, so it opens the list of them.
 */
export function notificationHref(
	notification: Pick<Notification, 'project_id' | 'deployment_id'> &
		Partial<Pick<Notification, 'category'>>
): string | null {
	const { project_id: projectId, deployment_id: deploymentId } = notification;
	if (notification.category === 'workspace' && !projectId) return '/workspace-invitations';
	if (projectId && deploymentId) return `/projects/${projectId}/deployments/${deploymentId}`;
	if (projectId) return `/projects/${projectId}`;
	return null;
}

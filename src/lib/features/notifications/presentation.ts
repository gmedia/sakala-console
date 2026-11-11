import type { Notification } from '$lib/api/resources/notifications';

/**
 * Where a notification leads. Account notifications have no page of their own. A workspace
 * notification opens its invitation, or else its team; older invitation notices carry neither ID,
 * so they open the list of invitations.
 */
export function notificationHref(
	notification: Pick<Notification, 'project_id' | 'deployment_id'> &
		Partial<Pick<Notification, 'category' | 'invitation_id' | 'workspace_id'>>
): string | null {
	const { project_id: projectId, deployment_id: deploymentId } = notification;
	if (notification.category === 'workspace' && !projectId) {
		if (notification.invitation_id) {
			return `/workspace-invitations/${encodeURIComponent(notification.invitation_id)}`;
		}
		if (notification.workspace_id) {
			return `/workspaces/${encodeURIComponent(notification.workspace_id)}`;
		}
		return '/workspace-invitations';
	}
	if (projectId && deploymentId) return `/projects/${projectId}/deployments/${deploymentId}`;
	if (projectId) return `/projects/${projectId}`;
	return null;
}

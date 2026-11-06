import type { Notification } from '$lib/api/resources/notifications';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const relativeTime = new Intl.RelativeTimeFormat('id-ID', { numeric: 'auto' });

/** Shown next to a notification: relative for the last week, then the date. */
export function formatNotificationTime(createdAt: string | null, now: number = Date.now()): string {
	if (!createdAt) return '';

	const time = new Date(createdAt);
	const elapsed = now - time.getTime();
	if (Number.isNaN(elapsed)) return '';

	if (elapsed < MINUTE) return 'Baru saja';
	if (elapsed < HOUR) return relativeTime.format(-Math.floor(elapsed / MINUTE), 'minute');
	if (elapsed < DAY) return relativeTime.format(-Math.floor(elapsed / HOUR), 'hour');
	if (elapsed < 7 * DAY) return relativeTime.format(-Math.floor(elapsed / DAY), 'day');

	return time.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Where a notification leads. Account notifications have no page of their own. */
export function notificationHref(
	notification: Pick<Notification, 'project_id' | 'deployment_id'>
): string | null {
	const { project_id: projectId, deployment_id: deploymentId } = notification;
	if (projectId && deploymentId) return `/projects/${projectId}/deployments/${deploymentId}`;
	if (projectId) return `/projects/${projectId}`;
	return null;
}

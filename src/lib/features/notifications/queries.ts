import { createQuery, keepPreviousData } from '@tanstack/svelte-query';
import { queryKeys } from '$lib/api/query-keys';
import {
	getNotificationPreferences,
	getUnreadNotificationCount,
	listNotifications,
	type NotificationListParams
} from '$lib/api/resources/notifications';
import { realtimeState, type ConnectionStatus } from '$lib/realtime/connection-state.svelte';

/** Realtime delivers new notifications; polling is the fallback for when it cannot. */
export function notificationPollInterval(status: ConnectionStatus): number {
	return status === 'connected' ? 5 * 60_000 : 60_000;
}

export function createUnreadNotificationCountQuery() {
	return createQuery(() => ({
		queryKey: queryKeys.notifications.unreadCount,
		queryFn: getUnreadNotificationCount,
		refetchInterval: notificationPollInterval(realtimeState.status)
	}));
}

export function createNotificationsQuery(
	params: () => NotificationListParams,
	enabled: () => boolean = () => true
) {
	return createQuery(() => ({
		queryKey: queryKeys.notifications.list(params()),
		queryFn: () => listNotifications(params()),
		enabled: enabled(),
		placeholderData: keepPreviousData,
		refetchInterval: notificationPollInterval(realtimeState.status)
	}));
}

export function createNotificationPreferencesQuery() {
	return createQuery(() => ({
		queryKey: queryKeys.notifications.preferences,
		queryFn: getNotificationPreferences
	}));
}

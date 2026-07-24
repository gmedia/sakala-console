import { createQuery } from '@tanstack/svelte-query';
import { queryKeys } from '$lib/api/query-keys';
import { apiRequest } from '$lib/api/client';
import type { UnreadNotificationCount, UnreadNotificationCountResponse } from './types';

export async function getUnreadNotificationCount(): Promise<UnreadNotificationCount> {
	try {
		const response = await apiRequest<UnreadNotificationCountResponse>(
			'/api/v1/notifications/unread-count'
		);
		return response.data;
	} catch {
		return { has_unread: false, unread_count: 0 };
	}
}

export function createUnreadNotificationCountQuery() {
	return createQuery(() => ({
		queryKey: queryKeys.notifications.unreadCount,
		queryFn: getUnreadNotificationCount
	}));
}

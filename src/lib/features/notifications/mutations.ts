import { createMutation, useQueryClient } from '@tanstack/svelte-query';
import { queryKeys } from '$lib/api/query-keys';
import {
	markAllNotificationsRead,
	markNotificationRead,
	updateNotificationPreferences,
	type NotificationPreferences
} from '$lib/api/resources/notifications';

export function useMarkNotificationRead() {
	const queryClient = useQueryClient();

	return createMutation(() => ({
		mutationFn: (id: string) => markNotificationRead(id),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })
	}));
}

export function useMarkAllNotificationsRead() {
	const queryClient = useQueryClient();

	return createMutation(() => ({
		mutationFn: () => markAllNotificationsRead(),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })
	}));
}

export function useUpdateNotificationPreferences() {
	const queryClient = useQueryClient();

	return createMutation(() => ({
		mutationFn: (changes: Partial<NotificationPreferences>) =>
			updateNotificationPreferences(changes),
		onSuccess: (preferences) =>
			queryClient.setQueryData(queryKeys.notifications.preferences, preferences)
	}));
}

import { createMutation, useQueryClient } from '@tanstack/svelte-query';
import { queryKeys } from '$lib/api/query-keys';
import {
	markAllNotificationsRead,
	markNotificationRead,
	updateNotificationPreferences,
	type NotificationPreferences,
	type NotificationPreferencesChange
} from '$lib/api/resources/notifications';
import { applyPreferencesChange, valuesForChange } from './preferences';

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

/** What the switch showed before this change, to put back if the API refuses it. */
type PreferencesRollback = { previous?: NotificationPreferences };

/**
 * Saves one switch at a time, as soon as it moves. The switch moves at once (the cache is updated
 * before the request), and moves back if the API refuses. Only the keys of this change are taken
 * from the answer, so a slower answer to an earlier switch cannot undo a later one.
 */
export function useUpdateNotificationPreferences() {
	const queryClient = useQueryClient();
	const key = queryKeys.notifications.preferences;

	return createMutation<
		NotificationPreferences,
		Error,
		NotificationPreferencesChange,
		PreferencesRollback
	>(() => ({
		mutationFn: (change) => updateNotificationPreferences(change),
		onMutate: async (change) => {
			await queryClient.cancelQueries({ queryKey: key });
			const previous = queryClient.getQueryData<NotificationPreferences>(key);
			if (previous) queryClient.setQueryData(key, applyPreferencesChange(previous, change));
			return { previous };
		},
		onError: (_error, change, context) => {
			const current = queryClient.getQueryData<NotificationPreferences>(key);
			if (!current || !context?.previous) return;
			queryClient.setQueryData(
				key,
				applyPreferencesChange(current, valuesForChange(context.previous, change))
			);
		},
		onSuccess: (saved, change) => {
			const current = queryClient.getQueryData<NotificationPreferences>(key) ?? saved;
			queryClient.setQueryData(
				key,
				applyPreferencesChange(current, valuesForChange(saved, change))
			);
		}
	}));
}

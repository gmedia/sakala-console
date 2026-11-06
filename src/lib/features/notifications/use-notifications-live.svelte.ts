import { useQueryClient } from '@tanstack/svelte-query';
import { queryKeys } from '$lib/api/query-keys';
import { usePrivateChannel } from '$lib/features/realtime/use-channel.svelte';
import { realtimeState } from '$lib/realtime/connection-state.svelte';

/**
 * `notification.created` on `users.{id}` refreshes the bell and the list. Events sent while the
 * socket was down never arrive, so a reconnect refreshes too. The query cache stays the source of
 * what renders.
 */
export function useNotificationsLive(userId: () => number | null) {
	const client = useQueryClient();

	function refresh() {
		void client.invalidateQueries({ queryKey: queryKeys.notifications.all });
	}

	usePrivateChannel(
		() => {
			const id = userId();
			return id === null ? null : `users.${id}`;
		},
		{ '.notification.created': refresh }
	);

	let wasConnected = false;
	$effect(() => {
		const connected = realtimeState.status === 'connected';
		if (connected && !wasConnected) refresh();
		wasConnected = connected;
	});
}

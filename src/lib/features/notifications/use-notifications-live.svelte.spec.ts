import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { queryKeys } from '$lib/api/query-keys';
import { usePrivateChannel } from '$lib/features/realtime/use-channel.svelte';
import { realtimeState } from '$lib/realtime/connection-state.svelte';
import { useNotificationsLive } from './use-notifications-live.svelte';

const client = vi.hoisted(() => ({ invalidateQueries: vi.fn() }));

vi.mock('@tanstack/svelte-query', async (original) => ({
	...(await original<object>()),
	useQueryClient: () => client
}));

vi.mock('$lib/features/realtime/use-channel.svelte', () => ({
	usePrivateChannel: vi.fn()
}));

function mount(userId: number | null) {
	return $effect.root(() => {
		useNotificationsLive(() => userId);
	});
}

function channelCall() {
	const [name, events] = vi.mocked(usePrivateChannel).mock.lastCall!;
	return { name: name as () => string | null, events };
}

describe('useNotificationsLive', () => {
	beforeEach(() => {
		client.invalidateQueries.mockReset();
		vi.mocked(usePrivateChannel).mockReset();
		realtimeState.status = 'idle';
	});

	it('listens on the private channel of the signed-in user', () => {
		const stop = mount(7);

		expect(channelCall().name()).toBe('users.7');
		stop();
	});

	it('does not subscribe until the user is known', () => {
		const stop = mount(null);

		expect(channelCall().name()).toBeNull();
		stop();
	});

	it('refreshes the bell and the list when a notification arrives', () => {
		const stop = mount(7);

		channelCall().events['.notification.created']({});

		expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['notifications'] });
		stop();
	});

	it('catches up after a reconnect, because events sent while offline are lost', () => {
		const stop = mount(7);
		flushSync();
		expect(client.invalidateQueries).not.toHaveBeenCalled();

		realtimeState.status = 'connected';
		flushSync();

		expect(client.invalidateQueries).toHaveBeenCalledWith({
			queryKey: queryKeys.notifications.all
		});
		expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.projects.lists });
		stop();
	});
});

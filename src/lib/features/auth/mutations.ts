import { createMutation, useQueryClient } from '@tanstack/svelte-query';
import { logout } from '$lib/api/resources/auth';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { disconnectEcho } from '$lib/realtime/echo';

export function useLogout() {
	const queryClient = useQueryClient();

	function cleanupSession() {
		queryClient.clear();
		disconnectEcho();
		goto(resolve('/login'));
	}

	return createMutation(() => ({
		mutationFn: logout,
		onSuccess: () => {
			cleanupSession();
		},
		onError: (error: unknown) => {
			const err = error as { status?: number; response?: { status?: number } };

			if (err?.status === 401 || err?.response?.status === 401) {
				cleanupSession();
				return;
			}

			console.error('Logout failed:', error);
		}
	}));
}

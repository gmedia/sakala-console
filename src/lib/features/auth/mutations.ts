import { createMutation, useQueryClient } from '@tanstack/svelte-query';
import { logout } from '$lib/api/resources/auth';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { disconnectEcho } from '$lib/realtime/echo';

export function useLogout() {
	const queryClient = useQueryClient();

	return createMutation(() => ({
		mutationFn: logout,
		onSuccess: () => {
			queryClient.clear();
			disconnectEcho();
			goto(resolve('/login'));
		}
	}));
}

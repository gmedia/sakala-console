import { createMutation, useQueryClient } from '@tanstack/svelte-query';
import { logout } from '$lib/api/resources/auth';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

export function useLogout() {
	const queryClient = useQueryClient();

	return createMutation(() => ({
		mutationFn: logout,
		onSuccess: () => {
			queryClient.clear();
			goto(resolve('/login'));
		}
	}));
}

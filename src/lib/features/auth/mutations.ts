import { createMutation, useQueryClient } from '@tanstack/svelte-query';
import {
	logout,
	login,
	register,
	type LoginPayload,
	type RegisterPayload
} from '$lib/api/resources/auth';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { disconnectEcho } from '$lib/realtime/echo';
import { queryKeys } from '$lib/api/query-keys';
import { setLastLoginProvider } from '$lib/features/auth/utils/oauth';

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

export function useLogin() {
	const queryClient = useQueryClient();

	return createMutation(() => ({
		mutationFn: (payload: LoginPayload) => login(payload),
		onSuccess: (user) => {
			setLastLoginProvider('email');
			queryClient.setQueryData(queryKeys.auth.currentUser, user);
		}
	}));
}

export function useRegister() {
	return createMutation(() => ({
		mutationFn: (payload: RegisterPayload) => register(payload)
	}));
}

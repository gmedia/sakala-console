import { createQuery } from '@tanstack/svelte-query';
import { apiRequest } from '$lib/api/client';
import type { UserResource } from './types';

export const authKeys = {
	all: ['auth'] as const,
	currentUser: () => [...authKeys.all, 'currentUser'] as const
};

export function currentUserQuery(enabled: boolean | (() => boolean) = true) {
	return createQuery(() => ({
		queryKey: authKeys.currentUser(),
		queryFn: () => apiRequest<UserResource>('api/user'),
		enabled: typeof enabled === 'function' ? enabled() : enabled,
		retry: false,
		staleTime: 5 * 60 * 1000
	}));
}

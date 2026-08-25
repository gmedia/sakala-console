import { createQuery } from '@tanstack/svelte-query';
import { queryKeys } from '$lib/api/query-keys';
import { getCurrentUser } from '$lib/api/resources/auth';
import { ApiError } from '$lib/api/errors';

export function useCurrentUser() {
	return createQuery(() => ({
		queryKey: queryKeys.auth.currentUser,
		queryFn: getCurrentUser,
		retry: (failureCount, error) => {
			if (error instanceof ApiError && error.isUnauthenticated) {
				return false;
			}
			return failureCount < 3;
		},
		staleTime: 1000 * 60 * 5
	}));
}

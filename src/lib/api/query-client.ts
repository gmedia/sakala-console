import { hashKey, MutationCache, QueryCache, QueryClient } from '@tanstack/svelte-query';
import { ApiError, LEGAL_ACCEPTANCE_REQUIRED } from './errors';
import { queryKeys } from './query-keys';

type SessionExpiredHandler = () => void;

let sessionExpiredHandler: SessionExpiredHandler | null = null;

/** The handler lives in features/auth, so this layer needs no router. */
export function setSessionExpiredHandler(handler: SessionExpiredHandler | null): void {
	sessionExpiredHandler = handler;
}

/**
 * Only a 401 means the session is gone. 403, 419, network, and 5xx stay on the page, where each
 * screen explains them. A mutation whose 401 means something else, such as a wrong password on the
 * login form, opts out with `meta: { handlesUnauthenticated: true }`.
 */
export function reportApiError(error: unknown, meta?: Record<string, unknown>): void {
	if (!(error instanceof ApiError)) return;
	// The terms changed during this session. Re-reading the user brings up the acceptance screen.
	if (error.code === LEGAL_ACCEPTANCE_REQUIRED) {
		void queryClient.invalidateQueries({ queryKey: queryKeys.auth.currentUser });
		return;
	}
	if (!error.isUnauthenticated || meta?.handlesUnauthenticated) return;
	sessionExpiredHandler?.();
}

const AUTH_OPTIONS_HASH = hashKey(queryKeys.auth.options);

export const queryClient = new QueryClient({
	queryCache: new QueryCache({
		onError: (error, query) => reportApiError(error, query.meta)
	}),
	mutationCache: new MutationCache({
		onError: (error, _variables, _context, mutation) => reportApiError(error, mutation.meta)
	}),
	defaultOptions: {
		queries: {
			staleTime: 30_000,
			gcTime: 5 * 60_000,
			retry: (failureCount, error) =>
				!(
					error instanceof ApiError &&
					(error.isUnauthenticated || error.isRateLimited || error.isGithubRateLimited)
				) && failureCount < 1,
			refetchOnWindowFocus: false
		},
		mutations: {
			retry: 0
		}
	}
});

/**
 * Forgets everything from the session that just ended. The public auth options stay: they belong
 * to no session, and the login page is already reading them. Removing a query that is still
 * running would leave that page waiting forever.
 */
export function clearSessionCache(): void {
	queryClient.removeQueries({ predicate: (query) => query.queryHash !== AUTH_OPTIONS_HASH });
	queryClient.getMutationCache().clear();
}

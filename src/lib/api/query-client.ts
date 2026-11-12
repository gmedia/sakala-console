import { hashKey, MutationCache, QueryCache, QueryClient } from '@tanstack/svelte-query';
import { ApiError, LEGAL_ACCEPTANCE_REQUIRED } from './errors';
import { queryKeys, workspaceIdOfQueryKey } from './query-keys';

type SessionExpiredHandler = () => void;
type WorkspaceAccessHandler = (workspaceId: string) => void;

let sessionExpiredHandler: SessionExpiredHandler | null = null;
let workspaceAccessHandler: WorkspaceAccessHandler | null = null;

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

/** The handler lives in features/workspaces, which owns the toast and the navigation. */
export function setWorkspaceAccessHandler(handler: WorkspaceAccessHandler | null): void {
	workspaceAccessHandler = handler;
}

/**
 * Statuses a read about one workspace gets once the user no longer belongs to it: 403 after being
 * removed, 404 or 422 (`workspace_id` no longer exists) after it was deleted. The handler checks the
 * workspace list before acting, because a 403 can also mean a role changed.
 */
const LOST_WORKSPACE_STATUSES = new Set([403, 404, 422]);

export function reportWorkspaceQueryError(error: unknown, queryKey: readonly unknown[]): void {
	if (!(error instanceof ApiError) || !LOST_WORKSPACE_STATUSES.has(error.status)) return;
	const workspaceId = workspaceIdOfQueryKey(queryKey);
	if (workspaceId) workspaceAccessHandler?.(workspaceId);
}

const AUTH_OPTIONS_HASH = hashKey(queryKeys.auth.options);

export const queryClient = new QueryClient({
	queryCache: new QueryCache({
		onError: (error, query) => {
			reportApiError(error, query.meta);
			reportWorkspaceQueryError(error, query.queryKey);
		}
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

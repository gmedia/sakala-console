import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { page } from '$app/state';
import { clearSessionCache } from '$lib/api/query-client';
import { clearPendingOAuthProvider, loginPathWithReturnTo } from '$lib/features/auth/utils/oauth';
import { disconnectEcho } from '$lib/realtime/echo';
import { noteSessionEnded } from './session-notice';

const PROTECTED_ROUTE_GROUPS = ['/(app)', '/(onboarding)'];

let redirecting = false;

export function isProtectedRoute(routeId: string | null): boolean {
	return PROTECTED_ROUTE_GROUPS.some((group) => routeId?.startsWith(group));
}

/**
 * A 401 on any query or mutation means the session is gone, so the screen behind it cannot be
 * trusted. Public pages have no session to lose and handle their own errors. The cache is cleared
 * after the navigation so nothing from this session reaches whoever logs in next.
 */
export function handleSessionExpired(): void {
	if (redirecting || !isProtectedRoute(page.route.id)) return;
	redirecting = true;

	noteSessionEnded();
	clearPendingOAuthProvider();
	void disconnectEcho();
	void goto(resolve(loginPathWithReturnTo(page.url) as '/login'), { replaceState: true }).finally(
		() => {
			clearSessionCache();
			redirecting = false;
		}
	);
}

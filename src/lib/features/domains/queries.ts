import { createQuery } from '@tanstack/svelte-query';
import { ApiError } from '$lib/api/errors';
import { queryKeys } from '$lib/api/query-keys';
import { rateLimitWait } from '$lib/api/rate-limit';
import {
	DOMAIN_STATUS,
	listProjectDomains,
	type ProjectDomain
} from '$lib/api/resources/project-domains';
import { DOMAIN_PENDING_POLL_MS } from './presentation';

/** A 404 while the flag said on: the server turned custom domains off since. */
export function isDomainsOffError(error: unknown): boolean {
	return error instanceof ApiError && error.status === 404;
}

/**
 * No broadcast announces a check result, so the list polls while a domain waits for its DNS (the
 * API checks it every minute at first) and otherwise reads again on focus.
 */
export function domainPollInterval(
	domains: readonly ProjectDomain[] | undefined,
	error?: unknown
): number | false {
	const wait = rateLimitWait(error);
	if (wait !== undefined) return wait;
	return domains?.some((domain) => domain.status === DOMAIN_STATUS.pending)
		? DOMAIN_PENDING_POLL_MS
		: false;
}

export function createProjectDomainsQuery(projectId: () => string, enabled: () => boolean) {
	return createQuery(() => ({
		queryKey: queryKeys.customDomains.list(projectId()),
		queryFn: () => listProjectDomains(projectId()),
		enabled: Boolean(projectId()) && enabled(),
		// A 404 is an answer: asking again only repeats it.
		retry: (failureCount: number, error: unknown) => !isDomainsOffError(error) && failureCount < 2,
		refetchInterval: (query: { state: { data: ProjectDomain[] | undefined; error: unknown } }) =>
			domainPollInterval(query.state.data, query.state.error)
	}));
}

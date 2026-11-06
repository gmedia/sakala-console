import {
	createInfiniteQuery,
	createQuery,
	infiniteQueryOptions,
	useQueryClient,
	type QueryClient
} from '@tanstack/svelte-query';
import { z } from 'zod';
import { isRateLimitError, rateLimitWait } from '$lib/api/rate-limit';
import { queryKeys } from '$lib/api/query-keys';
import {
	getDeployment,
	getAllDeploymentEvents,
	getDeploymentLogs,
	DeploymentEventsTruncationError,
	type DeploymentEventsResponse,
	type DeploymentLogsResponse
} from '$lib/api/resources/deployment';
import { TERMINAL_STATUSES } from './deployment-presentation';
import {
	countLogLines,
	highestLogSequence,
	insertLogLine,
	isNewestPageCached,
	LOG_MAX_LINES,
	LOG_MAX_PAGES,
	LOG_PAGE_SIZE,
	logRetryDelay,
	mergeLogTail,
	shouldRetryLogRequest,
	type DeploymentLogLine,
	type DeploymentLogsCache
} from './deployment-logs';
import { realtimeState } from '$lib/realtime/connection-state.svelte';

/** While the socket is up, events carry the news, and this only catches a broadcast that was lost. */
export const REALTIME_CONNECTED_SAFETY_POLL_MS = 60_000;
export const FALLBACK_POLLING_INTERVAL_MS = 5_000;

export { rateLimitWait };

/**
 * A 429 wins even after the deployment finished: the read that was refused is the one that brings
 * the final state, so it still has to happen, later.
 */
export function resolveRefetchInterval(isTerminalStatus: boolean, error?: unknown): number | false {
	const wait = rateLimitWait(error);
	if (wait !== undefined) return wait;
	if (isTerminalStatus) return false;
	return realtimeState.status === 'connected'
		? REALTIME_CONNECTED_SAFETY_POLL_MS
		: FALLBACK_POLLING_INTERVAL_MS;
}

type DeploymentRead = Awaited<ReturnType<typeof getDeployment>>;

/**
 * `servingUnconfirmed` marks a copy patched from a broadcast that ended the deployment. Its
 * `is_active` predates the end, so it says nothing about what the project serves. The read that
 * follows replaces the whole entry, and the mark goes with it.
 */
export type DeploymentDetailCache = DeploymentRead & { servingUnconfirmed?: true };

const realtimeDeploymentSchema = z.object({
	status: z.string(),
	started_at: z.string().nullable().optional(),
	finished_at: z.string().nullable().optional(),
	commit_sha: z.string().nullable().optional(),
	commit_message: z.string().nullable().optional()
});

/**
 * Puts a `deployment.updated` broadcast into the cache, so a step forward costs no request. Returns
 * false when a read is still needed: the payload has no failure or `is_active`, which only matter
 * once a deployment has finished, and there is nothing to patch before the first read.
 */
export function applyRealtimeDeploymentUpdate(
	client: QueryClient,
	project: string,
	deployment: string,
	payload: unknown
): boolean {
	const parsed = realtimeDeploymentSchema.safeParse(payload);
	if (!parsed.success) return false;

	const queryKey = queryKeys.deployments.detail(project, deployment);
	const cached = client.getQueryData<DeploymentDetailCache>(queryKey);
	if (!cached) return false;

	const { status, started_at, finished_at, commit_sha, commit_message } = parsed.data;
	const finished = TERMINAL_STATUSES.has(status);
	client.setQueryData<DeploymentDetailCache>(queryKey, {
		...cached,
		...(finished ? { servingUnconfirmed: true as const } : {}),
		data: {
			...cached.data,
			status: status as typeof cached.data.status,
			started_at: started_at ?? cached.data.started_at,
			finished_at: finished_at ?? cached.data.finished_at,
			commit_sha: commit_sha ?? cached.data.commit_sha,
			commit_message: commit_message ?? cached.data.commit_message,
			queue_state: status === 'queued' ? cached.data.queue_state : null
		}
	});
	return !finished;
}

const realtimeEventSchema = z.object({
	level: z.enum(['info', 'warning', 'error']),
	type: z.string().nullable(),
	message: z.string(),
	occurred_at: z.string()
});

/**
 * Adds a `deployment.event.created` broadcast to the timeline without a request. Its `sequence`
 * counts all realtime events of the deployment rather than this list, so the row gets the next
 * local number, and the read that follows the end of the deployment replaces the list anyway.
 */
export function applyRealtimeDeploymentEvent(
	client: QueryClient,
	project: string,
	deployment: string,
	payload: unknown
): boolean {
	const parsed = realtimeEventSchema.safeParse(payload);
	if (!parsed.success) return false;

	const queryKey = queryKeys.deployments.events(project, deployment);
	const cached = client.getQueryData<DeploymentEventsResponse>(queryKey);
	if (!cached) return false;

	const incoming = parsed.data;
	const known = cached.data.some(
		(event) =>
			event.type === incoming.type &&
			event.message === incoming.message &&
			Date.parse(event.occurred_at) === Date.parse(incoming.occurred_at)
	);
	if (known) return true;

	const sequence = cached.data.reduce((highest, event) => Math.max(highest, event.sequence), 0) + 1;
	client.setQueryData(queryKey, {
		...cached,
		data: [...cached.data, { ...incoming, sequence, metadata: null }]
	});
	return true;
}

export function createDeploymentQuery(projectId: () => string, deploymentId: () => string) {
	return createQuery(() => {
		const project = projectId();
		const deployment = deploymentId();

		return {
			queryKey: queryKeys.deployments.detail(project, deployment),
			queryFn: (): Promise<DeploymentDetailCache> => getDeployment(project, deployment),
			refetchInterval: (query) => {
				const status = query.state.data?.data.status;
				return resolveRefetchInterval(!!status && TERMINAL_STATUSES.has(status), query.state.error);
			},
			enabled: !!project && !!deployment
		};
	});
}

export function createDeploymentEventsQuery(
	projectId: () => string,
	deploymentId: () => string,
	isTerminal: () => boolean
) {
	return createQuery(() => {
		const project = projectId();
		const deployment = deploymentId();

		return {
			queryKey: queryKeys.deployments.events(project, deployment),
			queryFn: () => getAllDeploymentEvents(project, deployment),
			refetchInterval: (query) => resolveRefetchInterval(isTerminal(), query.state.error),
			enabled: !!project && !!deployment,
			retry: (failureCount: number, error: unknown) => {
				if (error instanceof DeploymentEventsTruncationError || isRateLimitError(error)) {
					return false;
				}
				return failureCount < 3;
			}
		};
	});
}

/**
 * History lives in one infinite query, newest page first: `next_cursor` walks to older lines, and
 * `maxPages` bounds memory by evicting from the far end. New lines come from realtime or from
 * `refreshDeploymentLogsTail`, so refetching here, which would request every page again, is off.
 */
export function deploymentLogsQueryOptions(project: string, deployment: string) {
	return infiniteQueryOptions({
		queryKey: queryKeys.deployments.logs(deployment),
		queryFn: ({ pageParam }: { pageParam: string | null }) =>
			getDeploymentLogs(project, deployment, {
				cursor: pageParam ?? undefined,
				per_page: LOG_PAGE_SIZE,
				order: 'desc'
			}),
		initialPageParam: null as string | null,
		getNextPageParam: (lastPage: DeploymentLogsResponse) => lastPage.meta.next_cursor,
		getPreviousPageParam: (firstPage: DeploymentLogsResponse) => firstPage.meta.prev_cursor,
		maxPages: LOG_MAX_PAGES,
		staleTime: Infinity,
		refetchOnReconnect: false,
		retry: shouldRetryLogRequest,
		retryDelay: logRetryDelay
	});
}

export function createDeploymentLogsQuery(projectId: () => string, deploymentId: () => string) {
	return createInfiniteQuery(() => ({
		...deploymentLogsQueryOptions(projectId(), deploymentId()),
		enabled: !!projectId() && !!deploymentId()
	}));
}

/**
 * Reads the newest lines into the cache. It stays quiet before history exists, and while someone is
 * reading a window that no longer holds the newest page, unless `force` asks to go back to it.
 */
export async function refreshDeploymentLogsTail(
	client: QueryClient,
	project: string,
	deployment: string,
	{ force = false }: { force?: boolean } = {}
): Promise<boolean> {
	const queryKey = queryKeys.deployments.logs(deployment);
	const cached = client.getQueryData<DeploymentLogsCache>(queryKey);
	if (!cached || (!force && !isNewestPageCached(cached))) return false;

	const page = await getDeploymentLogs(project, deployment, {
		per_page: LOG_PAGE_SIZE,
		order: 'desc'
	});

	client.setQueryData<DeploymentLogsCache>(queryKey, (current) =>
		current ? mergeLogTail(current, page) : current
	);
	return true;
}

export type RealtimeLogOutcome = 'applied' | 'ignored' | 'needs-tail';

/**
 * Puts a broadcast line into the cache, deduped on `log_sequence`. A line that skips ahead means
 * some broadcasts were lost, so the caller should read the tail. Before history has arrived there
 * is nothing to add to: the fetch in flight, the next line, or the final tail read covers it.
 */
export function applyRealtimeLogLine(
	client: QueryClient,
	deployment: string,
	line: DeploymentLogLine,
	{ canEvict }: { canEvict: boolean }
): RealtimeLogOutcome {
	const queryKey = queryKeys.deployments.logs(deployment);
	const cached = client.getQueryData<DeploymentLogsCache>(queryKey);
	if (!cached || !isNewestPageCached(cached)) return 'ignored';

	if (countLogLines(cached) >= LOG_MAX_LINES) return canEvict ? 'needs-tail' : 'ignored';

	client.setQueryData<DeploymentLogsCache>(queryKey, insertLogLine(cached, line));
	return line.sequence > highestLogSequence(cached) + 1 ? 'needs-tail' : 'applied';
}

/** Realtime already delivers lines while connected, so only a lost connection polls the tail. */
export function resolveLogTailInterval(isTerminal: boolean, error?: unknown): number | false {
	if (isTerminal) return false;
	const wait = rateLimitWait(error);
	if (wait !== undefined) return wait;
	return realtimeState.status === 'connected' ? false : FALLBACK_POLLING_INTERVAL_MS;
}

export function createDeploymentLogsTailQuery(
	projectId: () => string,
	deploymentId: () => string,
	isTerminal: () => boolean
) {
	const client = useQueryClient();

	return createQuery(() => {
		const project = projectId();
		const deployment = deploymentId();

		return {
			queryKey: queryKeys.deployments.logsTail(deployment),
			queryFn: () => refreshDeploymentLogsTail(client, project, deployment),
			// Only its interval and explicit requests read: a status change must not count as a reason.
			staleTime: Infinity,
			refetchInterval: (query) => resolveLogTailInterval(isTerminal(), query.state.error),
			enabled: !!project && !!deployment,
			retry: false
		};
	});
}

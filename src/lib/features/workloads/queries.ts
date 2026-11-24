import { createInfiniteQuery, createQuery } from '@tanstack/svelte-query';
import { ApiError } from '$lib/api/errors';
import { queryKeys } from '$lib/api/query-keys';
import { listProcesses } from '$lib/api/resources/processes';
import {
	getSchedule,
	getScheduleRunLogs,
	getScheduleRuns,
	listSchedules,
	SCHEDULE_PAGE_SIZE_MAX,
	type ProjectSchedule,
	type ScheduleRunLogsPage,
	type ScheduleRunsPage
} from '$lib/api/resources/schedules';
import { rateLimitWait } from '$lib/api/rate-limit';
import { isOpenRun } from './schedules';

/*
 * No broadcast announces a worker crash or a schedule run, so these reads poll: quickly while a run
 * is open (it ends within minutes), slowly otherwise, and back off when the API rate-limits.
 */
export const WORKLOAD_POLL_IDLE_MS = 60_000;
export const WORKLOAD_POLL_OPEN_RUN_MS = 5_000;

/** Runs per history page. */
export const RUN_HISTORY_PAGE_SIZE = 10;

export function workloadPollInterval(hasOpenRun: boolean, error?: unknown): number {
	const wait = rateLimitWait(error);
	if (wait !== undefined) return wait;
	return hasOpenRun ? WORKLOAD_POLL_OPEN_RUN_MS : WORKLOAD_POLL_IDLE_MS;
}

/** A 404 while the flag said on: an API that turned the feature off since, so the UI steps back. */
export function isFeatureOffError(error: unknown): boolean {
	return error instanceof ApiError && error.status === 404;
}

/** A 404 is an answer, not a hiccup: asking again only repeats it. */
function retryUnlessNotFound(failureCount: number, error: unknown): boolean {
	return !isFeatureOffError(error) && failureCount < 2;
}

export function createProcessesQuery(projectId: () => string, enabled: () => boolean) {
	return createQuery(() => ({
		queryKey: queryKeys.workloads.processes(projectId()),
		queryFn: () => listProcesses(projectId()),
		enabled: Boolean(projectId()) && enabled(),
		retry: retryUnlessNotFound,
		refetchInterval: (query: { state: { error: unknown } }) =>
			workloadPollInterval(false, query.state.error)
	}));
}

function scheduleHasOpenRun(schedule: Pick<ProjectSchedule, 'latest_run'> | undefined): boolean {
	return Boolean(schedule?.latest_run && isOpenRun(schedule.latest_run.status));
}

export function createSchedulesQuery(projectId: () => string, enabled: () => boolean) {
	return createQuery(() => ({
		queryKey: queryKeys.workloads.schedules(projectId()),
		queryFn: () => listSchedules(projectId()),
		enabled: Boolean(projectId()) && enabled(),
		retry: retryUnlessNotFound,
		refetchInterval: (query: { state: { data: ProjectSchedule[] | undefined; error: unknown } }) =>
			workloadPollInterval(
				query.state.data?.some((schedule) => scheduleHasOpenRun(schedule)) ?? false,
				query.state.error
			)
	}));
}

export function createScheduleQuery(projectId: () => string, scheduleId: () => string) {
	return createQuery(() => ({
		queryKey: queryKeys.workloads.schedule(projectId(), scheduleId()),
		queryFn: () => getSchedule(projectId(), scheduleId()),
		enabled: Boolean(projectId()) && Boolean(scheduleId()),
		retry: retryUnlessNotFound,
		refetchInterval: (query: { state: { data: ProjectSchedule | undefined; error: unknown } }) =>
			workloadPollInterval(scheduleHasOpenRun(query.state.data), query.state.error)
	}));
}

/** Newest first; "Muat run sebelumnya" walks back through `next_cursor`. */
export function createScheduleRunsQuery(projectId: () => string, scheduleId: () => string) {
	return createInfiniteQuery(() => ({
		queryKey: queryKeys.workloads.runs(projectId(), scheduleId()),
		queryFn: ({ pageParam }: { pageParam: string | null }) =>
			getScheduleRuns(projectId(), scheduleId(), {
				per_page: RUN_HISTORY_PAGE_SIZE,
				cursor: pageParam ?? undefined
			}),
		initialPageParam: null as string | null,
		getNextPageParam: (page: ScheduleRunsPage) => page.meta.next_cursor,
		enabled: Boolean(projectId()) && Boolean(scheduleId()),
		retry: retryUnlessNotFound,
		refetchInterval: (query: {
			state: { data: { pages: ScheduleRunsPage[] } | undefined; error: unknown };
		}) =>
			workloadPollInterval(
				query.state.data?.pages.some((page) => page.data.some((run) => isOpenRun(run.status))) ??
					false,
				query.state.error
			)
	}));
}

/** Oldest first, a page at a time. Re-read while the run is open, since it may still write. */
export function createScheduleRunLogsQuery(
	projectId: () => string,
	scheduleId: () => string,
	runId: () => string,
	runOpen: () => boolean
) {
	return createInfiniteQuery(() => ({
		queryKey: queryKeys.workloads.runLogs(projectId(), scheduleId(), runId()),
		queryFn: ({ pageParam }: { pageParam: string | null }) =>
			getScheduleRunLogs(projectId(), scheduleId(), runId(), {
				per_page: SCHEDULE_PAGE_SIZE_MAX,
				cursor: pageParam ?? undefined
			}),
		initialPageParam: null as string | null,
		getNextPageParam: (page: ScheduleRunLogsPage) => page.meta.next_cursor,
		enabled: Boolean(projectId()) && Boolean(scheduleId()) && Boolean(runId()),
		retry: retryUnlessNotFound,
		refetchInterval: (query: { state: { error: unknown } }) =>
			runOpen() ? workloadPollInterval(true, query.state.error) : false
	}));
}

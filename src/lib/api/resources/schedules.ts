import { z } from 'zod';
import { apiRequest } from '../client';
import type { components, paths } from '../generated/schema';
import {
	cursorLinksSchema,
	cursorMetaSchema,
	deploymentLogSchema,
	tolerantList,
	type DeploymentLog
} from './deployment';

/*
 * Schedules of a project and their runs (ADR-022, docs/API_CONVENTIONS.md "Jadwal" in sakala-api).
 * The endpoints answer 404 while the installation has schedules off; the Console asks only when
 * `schedules.enabled` says they are on. Times are UTC ISO 8601; `timezone` says how the expression
 * is read and how the Console shows them. Checked against responses captured from the API in
 * tests/fixtures/workloads.
 */

type GeneratedSchedule = components['schemas']['ProjectScheduleResource'];
type GeneratedRun = components['schemas']['ScheduleRunResource'];
type StoreScheduleRequest = components['schemas']['StoreProjectScheduleRequest'];

/** Every run status the API sends today. A newer one still renders, as a plain label. */
export const SCHEDULE_RUN_STATUSES = [
	'waiting',
	'queued',
	'running',
	'succeeded',
	'failed',
	'timed_out',
	'cancelled',
	'lost',
	'missed',
	'skipped'
] as const satisfies readonly components['schemas']['ScheduleRunStatus'][];
export type KnownScheduleRunStatus = (typeof SCHEDULE_RUN_STATUSES)[number];

/** The workspace already runs its limit of jobs; the run starts when one ends, or is missed. */
export const WAITING_RUN_STATUS: KnownScheduleRunStatus = 'waiting';

/** Runs that may still start or are running (ScheduleRunStatus::openCases). Stop run applies to these. */
export const OPEN_SCHEDULE_RUN_STATUSES: readonly string[] = [
	'waiting',
	'queued',
	'running'
] satisfies KnownScheduleRunStatus[];

export const SCHEDULE_RUN_TRIGGERS = {
	scheduled: 'scheduled',
	manual: 'manual'
} as const satisfies Record<string, components['schemas']['ScheduleRunTrigger']>;

export const SCHEDULE_HEALTH = {
	healthy: 'healthy',
	failing: 'failing'
} as const satisfies Record<string, components['schemas']['ScheduleHealth']>;

/** The only reason the control plane pauses a schedule by itself today. */
export const SCHEDULE_PAUSE_REASONS = {
	consecutiveFailures: 'consecutive_failures'
} as const satisfies Record<string, components['schemas']['SchedulePauseReason']>;

/* Status, reason, and health stay strings, so a value from a newer API still renders. */
const runSchema = z.object({
	id: z.string(),
	schedule_id: z.string(),
	trigger: z.string(),
	/** The slot, in UTC; `null` for a manual run. */
	scheduled_for: z.string().nullable(),
	status: z.string(),
	reason: z.string().nullable(),
	/** `reason` as a sentence for people, in Indonesian. */
	reason_message: z.string().nullable(),
	command: z.string(),
	timeout_seconds: z.number(),
	exit_code: z.number().nullable(),
	duration_ms: z.number().nullable(),
	oom_killed: z.boolean().nullable(),
	timed_out: z.boolean().nullable(),
	error_code: z.string().nullable(),
	/** What the failure means and what to do, in Indonesian. */
	error_summary: z.string().nullable(),
	deployment_id: z.string().nullable(),
	deadline_at: z.string().nullable(),
	started_at: z.string().nullable(),
	finished_at: z.string().nullable(),
	created_at: z.string().nullable()
}) satisfies z.ZodType<
	Omit<GeneratedRun, 'trigger' | 'status' | 'reason' | 'reason_message' | 'error_summary'> & {
		trigger: string;
		status: string;
		reason: string | null;
		reason_message: string | null;
		error_summary: string | null;
	},
	unknown
>;
export type ScheduleRun = z.output<typeof runSchema>;

const scheduleSchema = z.object({
	id: z.string(),
	project_id: z.string(),
	name: z.string(),
	command: z.string(),
	cron_expression: z.string(),
	timezone: z.string(),
	timeout_seconds: z.number(),
	enabled: z.boolean(),
	/** The next slot, in UTC; `null` while disabled. */
	next_run_at: z.string().nullable(),
	health: z.string(),
	consecutive_failures: z.number(),
	/** When the control plane disabled it by itself; enabling it clears this. */
	paused_at: z.string().nullable(),
	pause_reason: z.string().nullable(),
	latest_run: runSchema.nullable().default(null),
	created_at: z.string().nullable(),
	updated_at: z.string().nullable()
}) satisfies z.ZodType<
	Omit<GeneratedSchedule, 'health' | 'pause_reason' | 'latest_run'> & {
		health: string;
		pause_reason: string | null;
		latest_run: ScheduleRun | null;
	},
	unknown
>;
export type ProjectSchedule = z.output<typeof scheduleSchema>;

type RunsPage =
	paths['/v1/app/projects/{project}/schedules/{schedule}/runs']['get']['responses'][200]['content']['application/json'];
type RunLogsPage =
	paths['/v1/app/projects/{project}/schedules/{schedule}/runs/{run}/logs']['get']['responses'][200]['content']['application/json'];

const runsPageSchema = z.object({
	data: tolerantList(runSchema, 'run jadwal'),
	links: cursorLinksSchema,
	meta: cursorMetaSchema
}) satisfies z.ZodType<Omit<RunsPage, 'data'> & { data: ScheduleRun[] }, unknown>;
export type ScheduleRunsPage = z.output<typeof runsPageSchema>;

const runLogsPageSchema = z.object({
	data: tolerantList(deploymentLogSchema, 'baris log run'),
	links: cursorLinksSchema,
	meta: cursorMetaSchema
}) satisfies z.ZodType<Omit<RunLogsPage, 'data'> & { data: DeploymentLog[] }, unknown>;
export type ScheduleRunLogsPage = z.output<typeof runLogsPageSchema>;

const scheduleListSchema = z.object({ data: z.array(scheduleSchema) });
const scheduleResponseSchema = z.object({ data: scheduleSchema });
const runResponseSchema = z.object({ data: runSchema });

export const parseScheduleList = (response: unknown) => scheduleListSchema.parse(response).data;
export const parseSchedule = (response: unknown) => scheduleResponseSchema.parse(response).data;
export const parseScheduleRun = (response: unknown) => runResponseSchema.parse(response).data;
export const parseScheduleRunsPage = (response: unknown) => runsPageSchema.parse(response);
export const parseScheduleRunLogsPage = (response: unknown) => runLogsPageSchema.parse(response);

export type SchedulePayload = Required<StoreScheduleRequest>;

/** Pages of history and output: the API takes 1 to 50 (IndexScheduleRunRequest). */
export const SCHEDULE_PAGE_SIZE_MAX = 50;

const segment = (value: string) => encodeURIComponent(value);
const schedulesPath = (projectId: string) => `/api/v1/app/projects/${segment(projectId)}/schedules`;
const schedulePath = (projectId: string, scheduleId: string) =>
	`${schedulesPath(projectId)}/${segment(scheduleId)}`;
const runPath = (projectId: string, scheduleId: string, runId: string) =>
	`${schedulePath(projectId, scheduleId)}/runs/${segment(runId)}`;

/** Oldest first, each with its newest run. Every member reads them. */
export async function listSchedules(projectId: string): Promise<ProjectSchedule[]> {
	return parseScheduleList(await apiRequest<unknown>(schedulesPath(projectId)));
}

export async function getSchedule(projectId: string, scheduleId: string): Promise<ProjectSchedule> {
	return parseSchedule(await apiRequest<unknown>(schedulePath(projectId, scheduleId)));
}

/**
 * `201`. Refused with 422 on `cron_expression` when two slots are closer than the workspace's
 * minimum interval, and 422 `SCHEDULE_LIMIT_EXCEEDED` when it would be one enabled schedule too many.
 */
export async function createSchedule(
	projectId: string,
	payload: SchedulePayload
): Promise<ProjectSchedule> {
	return parseSchedule(
		await apiRequest<unknown>(schedulesPath(projectId), { method: 'POST', json: payload })
	);
}

/** Enabling a paused schedule clears the pause and its failure count. */
export async function updateSchedule(
	projectId: string,
	scheduleId: string,
	payload: Partial<SchedulePayload>
): Promise<ProjectSchedule> {
	return parseSchedule(
		await apiRequest<unknown>(schedulePath(projectId, scheduleId), {
			method: 'PATCH',
			json: payload
		})
	);
}

/** `204`, with its history; an open run is stopped first. */
export async function deleteSchedule(projectId: string, scheduleId: string): Promise<void> {
	await apiRequest<void>(schedulePath(projectId, scheduleId), { method: 'DELETE' });
}

/** Newest first. The API keeps the newest 100 runs of a schedule. */
export async function getScheduleRuns(
	projectId: string,
	scheduleId: string,
	params: { cursor?: string; per_page?: number } = {}
): Promise<ScheduleRunsPage> {
	return parseScheduleRunsPage(
		await apiRequest<unknown>(`${schedulePath(projectId, scheduleId)}/runs`, { params })
	);
}

/**
 * Run now: `201` with a `queued` run, or `waiting` when the workspace already runs its limit of
 * jobs. Refused with 409 `SCHEDULE_RUN_REFUSED` and a `reason` when a slot would be skipped.
 */
export async function runScheduleNow(projectId: string, scheduleId: string): Promise<ScheduleRun> {
	return parseScheduleRun(
		await apiRequest<unknown>(`${schedulePath(projectId, scheduleId)}/runs`, { method: 'POST' })
	);
}

/**
 * Stop run: `200` when it ended at once as `cancelled`, `202` while the node still has to stop it
 * (the run stays open). 409 `SCHEDULE_RUN_NOT_OPEN` for a run that already ended.
 */
export async function cancelScheduleRun(
	projectId: string,
	scheduleId: string,
	runId: string
): Promise<ScheduleRun> {
	return parseScheduleRun(
		await apiRequest<unknown>(`${runPath(projectId, scheduleId, runId)}/cancel`, {
			method: 'POST'
		})
	);
}

/** The run's output, oldest first. Lines follow the deployment log retention (7 days). */
export async function getScheduleRunLogs(
	projectId: string,
	scheduleId: string,
	runId: string,
	params: { cursor?: string; per_page?: number } = {}
): Promise<ScheduleRunLogsPage> {
	return parseScheduleRunLogsPage(
		await apiRequest<unknown>(`${runPath(projectId, scheduleId, runId)}/logs`, { params })
	);
}

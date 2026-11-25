import { resolve } from '$app/paths';
import type { ResolvedPathname } from '$app/types';

/** The query parameter of a schedule's page that opens one run's log. */
export const RUN_PARAM = 'run';

/** The query parameter of a deployment's page that starts its log on one process. */
export const LOG_PROCESS_PARAM = 'process';

/** A deployment's log, filtered to one worker. */
export function processLogHref(projectId: string, deploymentId: string, process: string): string {
	return `${resolve(`/projects/${projectId}/deployments/${deploymentId}`)}?${new URLSearchParams({ [LOG_PROCESS_PARAM]: process })}#deployment-logs`;
}

/** The Jadwal page of the project's settings. */
export function schedulesHref(projectId: string): ResolvedPathname {
	return resolve(`/projects/${projectId}/settings/schedules`);
}

export function newScheduleHref(projectId: string): ResolvedPathname {
	return resolve(`/projects/${projectId}/settings/schedules/new`);
}

/** The new-schedule form, filled with a framework's suggestion (`?saran=laravel`). */
export const SUGGESTION_PARAM = 'saran';
export const LARAVEL_SUGGESTION = 'laravel';

export function suggestedScheduleHref(projectId: string): string {
	return `${newScheduleHref(projectId)}?${new URLSearchParams({ [SUGGESTION_PARAM]: LARAVEL_SUGGESTION })}`;
}

/** A schedule's page: its state, Run now, and run history. */
export function scheduleHref(projectId: string, scheduleId: string): ResolvedPathname {
	return resolve(`/projects/${projectId}/settings/schedules/${scheduleId}`);
}

/** The same page with one run's log open, so a run can be linked to. */
export function scheduleRunHref(projectId: string, scheduleId: string, runId: string): string {
	return `${scheduleHref(projectId, scheduleId)}?${new URLSearchParams({ [RUN_PARAM]: runId })}`;
}

export function editScheduleHref(projectId: string, scheduleId: string): ResolvedPathname {
	return resolve(`/projects/${projectId}/settings/schedules/${scheduleId}/edit`);
}

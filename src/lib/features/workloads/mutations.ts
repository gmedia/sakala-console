import { createMutation, useQueryClient, type QueryClient } from '@tanstack/svelte-query';
import { queryKeys } from '$lib/api/query-keys';
import {
	createProcess,
	deleteProcess,
	updateProcess,
	type ProcessPayload
} from '$lib/api/resources/processes';
import {
	cancelScheduleRun,
	createSchedule,
	deleteSchedule,
	runScheduleNow,
	updateSchedule,
	type ProjectSchedule,
	type SchedulePayload
} from '$lib/api/resources/schedules';
import { projectKeys } from '$lib/features/projects/queries';

/** A worker change turns on `redeploy_required`, which the project header and settings read. */
function refreshProcesses(client: QueryClient, projectId: string) {
	void client.invalidateQueries({ queryKey: queryKeys.workloads.processes(projectId) });
	void client.invalidateQueries({ queryKey: projectKeys.detail(projectId), exact: true });
}

/** Enabled schedules count towards `max_schedules`, which pilot-limits reports. */
function refreshSchedules(client: QueryClient, projectId: string) {
	void client.invalidateQueries({ queryKey: queryKeys.workloads.schedules(projectId) });
	void client.invalidateQueries({ queryKey: queryKeys.pilotLimits });
}

function storeSchedule(client: QueryClient, schedule: ProjectSchedule) {
	client.setQueryData(queryKeys.workloads.schedule(schedule.project_id, schedule.id), schedule);
}

export function createSaveProcessMutation() {
	const client = useQueryClient();
	return createMutation(() => ({
		mutationFn: ({
			projectId,
			processId,
			payload
		}: {
			projectId: string;
			processId?: string;
			payload: Partial<ProcessPayload>;
		}) =>
			processId
				? updateProcess(projectId, processId, payload)
				: createProcess(projectId, payload as ProcessPayload),
		onSuccess: (_process, { projectId }) => refreshProcesses(client, projectId)
	}));
}

export function createDeleteProcessMutation() {
	const client = useQueryClient();
	return createMutation(() => ({
		mutationFn: ({ projectId, processId }: { projectId: string; processId: string }) =>
			deleteProcess(projectId, processId),
		onSuccess: (_result, { projectId }) => refreshProcesses(client, projectId)
	}));
}

export function createSaveScheduleMutation() {
	const client = useQueryClient();
	return createMutation(() => ({
		mutationFn: ({
			projectId,
			scheduleId,
			payload
		}: {
			projectId: string;
			scheduleId?: string;
			payload: Partial<SchedulePayload>;
		}) =>
			scheduleId
				? updateSchedule(projectId, scheduleId, payload)
				: createSchedule(projectId, payload as SchedulePayload),
		onSuccess: (schedule, { projectId }) => {
			storeSchedule(client, schedule);
			refreshSchedules(client, projectId);
		}
	}));
}

export function createDeleteScheduleMutation() {
	const client = useQueryClient();
	return createMutation(() => ({
		mutationFn: ({ projectId, scheduleId }: { projectId: string; scheduleId: string }) =>
			deleteSchedule(projectId, scheduleId),
		onSuccess: (_result, { projectId, scheduleId }) => {
			client.removeQueries({ queryKey: queryKeys.workloads.schedule(projectId, scheduleId) });
			refreshSchedules(client, projectId);
		}
	}));
}

/** Run now and Stop run both change the history and the schedule's `latest_run`. */
function refreshRuns(client: QueryClient, projectId: string, scheduleId: string) {
	void client.invalidateQueries({ queryKey: queryKeys.workloads.runs(projectId, scheduleId) });
	void client.invalidateQueries({
		queryKey: queryKeys.workloads.schedule(projectId, scheduleId),
		exact: true
	});
	void client.invalidateQueries({
		queryKey: queryKeys.workloads.schedules(projectId),
		exact: true
	});
}

export function createRunScheduleNowMutation() {
	const client = useQueryClient();
	return createMutation(() => ({
		mutationFn: ({ projectId, scheduleId }: { projectId: string; scheduleId: string }) =>
			runScheduleNow(projectId, scheduleId),
		onSettled: (_run, _error, { projectId, scheduleId }) =>
			refreshRuns(client, projectId, scheduleId)
	}));
}

export function createCancelScheduleRunMutation() {
	const client = useQueryClient();
	return createMutation(() => ({
		mutationFn: ({
			projectId,
			scheduleId,
			runId
		}: {
			projectId: string;
			scheduleId: string;
			runId: string;
		}) => cancelScheduleRun(projectId, scheduleId, runId),
		onSettled: (_run, _error, { projectId, scheduleId }) =>
			refreshRuns(client, projectId, scheduleId)
	}));
}

import { describe, expect, it } from 'vitest';
import { WORKLOAD_ERROR_CODES } from '$lib/api/errors';
import { errorFromWorkloadFixture, getWorkloadFixture } from '$lib/testing/workload-fixtures';
import { parseDeploymentLogsResponse } from './deployment';
import { parsePilotLimitsResponse } from './pilot-limits';
import { parseProcess, parseProcessList } from './processes';
import {
	parseSchedule,
	parseScheduleList,
	parseScheduleRun,
	parseScheduleRunLogsPage,
	parseScheduleRunsPage,
	SCHEDULE_RUN_STATUSES
} from './schedules';
import { parseWorkloadRefusal, SCHEDULE_RUN_REFUSAL_REASONS } from './workload-refusals';

const body = (name: string) => getWorkloadFixture(name).body;

describe('worker process responses (sakala-api #208)', () => {
	it('reads the list with a crashing worker and one that runs nothing', () => {
		const processes = parseProcessList(body('processes'));
		expect(processes.map((process) => process.name)).toEqual(['mailer', 'queue']);
		expect(processes[0]).toMatchObject({ replicas: 0, cpu_millis: 250, crash: null });
		expect(processes[1].crash).toEqual({
			exit_code: 1,
			oom_killed: false,
			finished_at: '2026-11-24T10:05:58Z',
			restart_count: 4,
			running: false,
			since: '2026-11-24T10:01:12Z'
		});
	});

	it('reads redeploy_required on the answer to a change, and its absence on the list', () => {
		expect(parseProcess(body('process-create')).redeploy_required).toBe(true);
		expect(parseProcessList(body('processes'))[0].redeploy_required).toBeUndefined();
		expect(parseProcessList(body('processes-empty'))).toEqual([]);
	});
});

describe('schedule responses (sakala-api #208)', () => {
	it('reads a new schedule in UTC with its defaults', () => {
		const schedule = parseSchedule(body('schedule-create'));
		expect(schedule).toMatchObject({
			cron_expression: '30 2 * * *',
			timezone: 'Asia/Jakarta',
			timeout_seconds: 300,
			enabled: true,
			next_run_at: '2026-11-24T19:30:00Z',
			health: 'healthy',
			latest_run: null
		});
	});

	it('reads a schedule Sakala paused after ten failures, with its newest run', () => {
		const schedule = parseSchedule(body('schedule-paused'));
		expect(schedule).toMatchObject({
			enabled: false,
			next_run_at: null,
			health: 'failing',
			consecutive_failures: 10,
			pause_reason: 'consecutive_failures'
		});
		expect(schedule.latest_run?.status).toBe('cancelled');
	});

	it('reads the list, each schedule with its newest run', () => {
		const schedules = parseScheduleList(body('schedules'));
		expect(schedules.length).toBeGreaterThan(0);
		expect(schedules[0].latest_run?.trigger).toBe('manual');
	});

	it('reads a history page and walks to the next with its cursor', () => {
		const first = parseScheduleRunsPage(body('runs'));
		const second = parseScheduleRunsPage(body('runs-page-2'));
		expect(first.data).toHaveLength(5);
		expect(first.meta.next_cursor).toEqual(expect.any(String));
		expect(second.data).toHaveLength(5);
		const statuses = [...first.data, ...second.data].map((run) => run.status);
		expect(new Set(statuses)).toEqual(
			new Set(['succeeded', 'failed', 'missed', 'skipped', 'timed_out', 'lost', 'cancelled'])
		);
		for (const status of statuses) expect(SCHEDULE_RUN_STATUSES).toContain(status);
	});

	it('reads why a run failed, was missed, or skipped, in the API words', () => {
		const runs = parseScheduleRunsPage(body('runs')).data;
		const failed = runs.find((run) => run.status === 'failed');
		expect(failed).toMatchObject({ exit_code: 1, duration_ms: 5230, error_code: 'job_failed' });
		expect(failed?.error_summary).toMatch(/kode selain 0/);
		const missed = runs.find((run) => run.status === 'missed');
		expect(missed?.reason).toBe('dispatcher_late');
		expect(missed?.reason_message).toMatch(/^Terlewat/);
	});

	it('reads a run now, its stop, and the run output with its process', () => {
		expect(parseScheduleRun(body('run-now'))).toMatchObject({
			trigger: 'manual',
			scheduled_for: null,
			status: 'queued'
		});
		expect(parseScheduleRun(body('run-cancel')).status).toBe('cancelled');
		const logs = parseScheduleRunLogsPage(body('run-logs'));
		expect(logs.data.map((line) => line.process)).toEqual(['job', 'job', 'job']);
		expect(logs.data[1]).toMatchObject({
			stream: 'stderr',
			message: expect.stringMatching(/SQLSTATE/)
		});
	});
});

describe('deployment log lines with a process', () => {
	it('keeps the process of worker and job lines, and null for web', () => {
		const page = parseDeploymentLogsResponse(body('deployment-logs-processes'));
		expect(page.data.slice(0, 5).map((line) => line.process)).toEqual([
			null,
			'job',
			'queue',
			'queue',
			null
		]);
	});

	it('still reads a line from an API before workers, without a process', () => {
		const page = parseDeploymentLogsResponse({
			data: [{ sequence: 1, stream: 'stdout', message: 'ok', recorded_at: '2026-01-01T00:00:00Z' }],
			links: { first: null, last: null, prev: null, next: null },
			meta: { path: null, per_page: 6, next_cursor: null, prev_cursor: null }
		});
		expect(page.data[0].process).toBeUndefined();
	});
});

describe('pilot limits for workers and schedules', () => {
	it('reads the flags on, with the limits of option A and a profile', () => {
		const limits = parsePilotLimitsResponse(body('pilot-limits-on'));
		expect(limits.workers).toEqual({ enabled: true });
		expect(limits.schedules).toEqual({
			enabled: true,
			default_timezone: 'Asia/Jakarta',
			default_timeout_seconds: 300,
			max_timeout_seconds: 600,
			start_deadline_minutes: 10
		});
		expect(limits.quotas).toMatchObject({
			max_worker_containers: 2,
			current_worker_containers_count: 0,
			max_schedules: 2,
			min_schedule_interval_minutes: 15,
			max_concurrent_job_runs: 1
		});
		expect(limits.runtime_maximums?.memory_mb).toEqual(expect.any(Number));
	});

	it('reads the flags off', () => {
		const limits = parsePilotLimitsResponse(body('pilot-limits-off'));
		expect(limits.workers?.enabled).toBe(false);
		expect(limits.schedules?.enabled).toBe(false);
	});
});

describe('workload refusals', () => {
	it('reads the reason of a refused run now', () => {
		for (const [fixture, reason] of [
			['run-now-overlap', SCHEDULE_RUN_REFUSAL_REASONS.overlap],
			['run-now-no-live', SCHEDULE_RUN_REFUSAL_REASONS.noLiveDeployment]
		] as const) {
			const error = errorFromWorkloadFixture(fixture);
			expect(error.code).toBe(WORKLOAD_ERROR_CODES.scheduleRunRefused);
			expect(
				parseWorkloadRefusal(WORKLOAD_ERROR_CODES.scheduleRunRefused, error.details)?.reason
			).toBe(reason);
		}
	});

	it('reads the counts of a schedule limit', () => {
		const error = errorFromWorkloadFixture('schedule-create-limit');
		expect(error.code).toBe(WORKLOAD_ERROR_CODES.scheduleLimitExceeded);
		expect(parseWorkloadRefusal(WORKLOAD_ERROR_CODES.scheduleLimitExceeded, error.details)).toEqual(
			{
				limit: 2,
				current: 2
			}
		);
	});

	it('answers 404 while the flags are off', () => {
		expect(getWorkloadFixture('processes-off').status).toBe(404);
		expect(getWorkloadFixture('schedules-off').status).toBe(404);
	});
});

import { readFileSync, writeFileSync } from 'node:fs';
import type { Page, Route } from '@playwright/test';
import { baseProject, logLine, logPage, personalWorkspace, PROJECT_ID } from './project-detail';

/** Bodies captured from sakala-api main ea7287b (#208), tests/fixtures/workloads. */
export function capturedWorkload<T = unknown>(name: string): { status: number; body: T } {
	const file = new URL(`../../fixtures/workloads/${name}.json`, import.meta.url);
	return JSON.parse(readFileSync(file, 'utf8')) as { status: number; body: T };
}

type Json = Record<string, unknown>;
const dataOf = <T = Json>(name: string) => capturedWorkload<{ data: T }>(name).body.data;

/** A Laravel project, so the Console offers the queue worker and the scheduler. */
export const laravelProject = {
	...baseProject,
	stack: {
		builder: 'railpack',
		provider: 'php',
		framework: 'laravel',
		package_manager: 'composer',
		monorepo: null
	}
};

export const TEAM_ID = '01a1cb4a-de2f-734f-a44f-2930000000aa';
const teamSummary = { id: TEAM_ID, name: 'Tim Kopi', slug: 'tim-kopi', type: 'team' };

/** The same project in a team where the signed-in user is only a viewer. */
export const viewerProject = { ...laravelProject, workspace: teamSummary };

/** Times relative to now, so "Run berikutnya" and relative times read sensibly. */
const minutesFromNow = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

export function workloadLimits(flags: { workers: boolean; schedules: boolean }) {
	const limits = dataOf<Json & { workers: Json; schedules: Json }>(
		flags.workers || flags.schedules ? 'pilot-limits-on' : 'pilot-limits-off'
	);
	return {
		...limits,
		workers: { ...limits.workers, enabled: flags.workers },
		schedules: { ...limits.schedules, enabled: flags.schedules }
	};
}

export type WorkloadState = {
	processes: Json[];
	schedules: Json[];
	runs: Json[];
	/** Bodies the mock received, by endpoint, for assertions. */
	requests: { method: string; path: string; body: Json | null }[];
	/** How Run now answers; captured 201 by default. */
	runNow?: { status: number; body: unknown };
};

export function workloadState(): WorkloadState {
	const runs = [...dataOf<Json[]>('runs'), ...dataOf<Json[]>('runs-page-2')];
	const scheduleId = dataOf('schedule-create').id as string;
	const second = {
		...dataOf('schedule-update'),
		name: 'Bersihkan sesi',
		enabled: true,
		paused_at: null,
		latest_run: { ...runs[0], created_at: minutesFromNow(-82) }
	};
	return {
		processes: dataOf<Json[]>('processes'),
		schedules: [
			{
				...dataOf('schedule-create'),
				health: 'failing',
				consecutive_failures: 1,
				latest_run: { ...runs[1], created_at: minutesFromNow(-25) }
			},
			second
		],
		runs: runs.map((run) => ({ ...run, schedule_id: scheduleId })),
		requests: []
	};
}

/** A deployment log with web, a worker, and a scheduled run's output, newest first as asked. */
export function mixedProcessLogs() {
	const lines = [
		logLine(1, 'Server listening on port 8000'),
		{ ...logLine(2, 'Processing: App\\Jobs\\SendInvoice'), process: 'queue' },
		{ ...logLine(3, 'Failed: App\\Jobs\\SendInvoice', 'stderr'), process: 'queue' },
		{ ...logLine(4, 'Report written to storage/reports/2026-11-24.csv'), process: 'job' },
		logLine(5, 'GET / 200 12ms')
	].map((line) => ({ process: null, ...line }));
	return logPage(lines.reverse());
}

function fulfill(route: Route, status: number, body?: unknown) {
	if (status === 204) return route.fulfill({ status });
	return route.fulfill({
		status,
		contentType: 'application/json',
		body: JSON.stringify(body ?? {})
	});
}

/**
 * The pilot limits with the ADR-022 flags, and the worker and schedule endpoints over `state`.
 * Registered after `mockProjectApi`, so these answer first. With a flag off the endpoints answer
 * 404, as sakala-api does.
 */
export async function mockWorkloadApi(
	page: Page,
	state: WorkloadState,
	flags: { workers: boolean; schedules: boolean } = { workers: true, schedules: true }
) {
	await page.route(/\/api\/v1\/app\/pilot-limits(\?.*)?$/, (route) =>
		fulfill(route, 200, { data: workloadLimits(flags) })
	);

	await page.route(/\/api\/v1\/app\/projects\/[^/]+\/processes(\/[^/?]+)?(\?.*)?$/, (route) => {
		const request = route.request();
		const method = request.method();
		const path = new URL(request.url()).pathname;
		const body = method === 'GET' || method === 'DELETE' ? null : (request.postDataJSON() as Json);
		state.requests.push({ method, path, body });
		if (!flags.workers) return fulfill(route, 404, { message: '' });

		const id = path.match(/\/processes\/([^/]+)$/)?.[1];
		if (method === 'GET') return fulfill(route, 200, { data: state.processes });
		if (method === 'POST') {
			const created = {
				...dataOf('process-create'),
				id: `pr-${state.processes.length + 1}`,
				replicas: 1,
				memory_mb: null,
				cpu_millis: null,
				...body
			};
			state.processes = [...state.processes, { ...created, redeploy_required: undefined }].sort(
				(a, b) => String(a.name).localeCompare(String(b.name))
			);
			return fulfill(route, 201, { data: created });
		}
		if (method === 'PATCH') {
			state.processes = state.processes.map((process) =>
				process.id === id ? { ...process, ...body } : process
			);
			return fulfill(route, 200, {
				data: { ...state.processes.find((process) => process.id === id), redeploy_required: true }
			});
		}
		state.processes = state.processes.filter((process) => process.id !== id);
		return fulfill(route, 204);
	});

	await page.route(/\/api\/v1\/app\/projects\/[^/]+\/schedules(\/.*)?(\?.*)?$/, (route) => {
		const request = route.request();
		const method = request.method();
		const url = new URL(request.url());
		const path = url.pathname;
		const body =
			method === 'POST' || method === 'PATCH' ? (request.postDataJSON() as Json | null) : null;
		state.requests.push({ method, path, body });
		if (!flags.schedules) return fulfill(route, 404, { message: '' });

		const [, scheduleId, , runId, action] =
			path.match(/\/schedules(?:\/([^/]+))?(?:\/(runs))?(?:\/([^/]+))?(?:\/(cancel|logs))?$/) ?? [];
		const schedule = state.schedules.find((item) => item.id === scheduleId);

		if (action === 'logs') return fulfill(route, 200, capturedWorkload('run-logs').body);
		if (action === 'cancel') {
			const run = state.runs.find((item) => item.id === runId);
			const cancelled = { ...run, status: 'cancelled', finished_at: new Date().toISOString() };
			state.runs = state.runs.map((item) => (item.id === runId ? cancelled : item));
			return fulfill(route, 200, { data: cancelled });
		}
		if (path.endsWith('/runs')) {
			if (method === 'POST') {
				const answer = state.runNow ?? { status: 201, body: capturedWorkload('run-now').body };
				if (answer.status === 201) {
					const run = (answer.body as { data: Json }).data;
					state.runs = [
						{ ...run, schedule_id: scheduleId, created_at: new Date().toISOString() },
						...state.runs
					];
				}
				return fulfill(route, answer.status, answer.body);
			}
			const perPage = Number(url.searchParams.get('per_page') ?? 20);
			const offset = Number(url.searchParams.get('cursor') ?? 0);
			const runs = state.runs.filter((run) => run.schedule_id === scheduleId);
			const next = offset + perPage < runs.length ? String(offset + perPage) : null;
			return fulfill(route, 200, {
				data: runs.slice(offset, offset + perPage),
				links: { first: null, last: null, prev: null, next: null },
				meta: { path: null, per_page: perPage, next_cursor: next, prev_cursor: null }
			});
		}
		if (!scheduleId) {
			if (method === 'POST') {
				const created = {
					...dataOf('schedule-create'),
					id: `sc-${state.schedules.length + 1}`,
					...body,
					next_run_at: minutesFromNow(60),
					latest_run: null
				};
				state.schedules = [...state.schedules, created];
				return fulfill(route, 201, { data: created });
			}
			return fulfill(route, 200, { data: state.schedules });
		}
		if (!schedule) return fulfill(route, 404, { message: 'Not found.' });
		if (method === 'PATCH') {
			const enabling = body?.enabled === true;
			const updated = {
				...schedule,
				...body,
				...(enabling
					? {
							paused_at: null,
							pause_reason: null,
							consecutive_failures: 0,
							health: 'healthy',
							next_run_at: minutesFromNow(60)
						}
					: {}),
				...(body?.enabled === false ? { next_run_at: null } : {})
			};
			state.schedules = state.schedules.map((item) => (item.id === scheduleId ? updated : item));
			return fulfill(route, 200, { data: updated });
		}
		if (method === 'DELETE') {
			state.schedules = state.schedules.filter((item) => item.id !== scheduleId);
			return fulfill(route, 204);
		}
		return fulfill(route, 200, { data: schedule });
	});
}

/** The signed-in user as a viewer of the team that owns `viewerProject`. */
export async function mockViewerWorkspaces(page: Page) {
	await page.route(/\/api\/v1\/app\/workspaces(\?.*)?$/, (route) =>
		fulfill(route, 200, {
			data: [
				personalWorkspace,
				{
					...teamSummary,
					role: 'viewer',
					limit_profile: null,
					created_at: '2026-01-01T00:00:00+00:00'
				}
			]
		})
	);
}

export const SETTINGS_URL = `/projects/${PROJECT_ID}/settings`;

/**
 * Screenshots for the pull request, written only when WORKLOAD_SCREENSHOTS names a folder, so CI
 * does not keep files nobody reads.
 */
export const SCREENSHOT_DIR = process.env.WORKLOAD_SCREENSHOTS;

/** Taller than a screen: the Console scrolls inside its main column, which fullPage cannot see. */
const SCREENSHOT_HEIGHT = 1600;

export async function screenshot(page: Page, name: string) {
	if (!SCREENSHOT_DIR) return;
	const size = page.viewportSize();
	if (size) await page.setViewportSize({ width: size.width, height: SCREENSHOT_HEIGHT });
	await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png` });
	// The rendered page too, for HTML audits outside the browser.
	writeFileSync(`${SCREENSHOT_DIR}/${name}.html`, await page.content());
	if (size) await page.setViewportSize(size);
}

/** Whether the page scrolls sideways, which a 320 px screen must never do. */
export async function scrollsSideways(page: Page): Promise<boolean> {
	return page.evaluate(
		() => document.documentElement.scrollWidth > document.documentElement.clientWidth
	);
}

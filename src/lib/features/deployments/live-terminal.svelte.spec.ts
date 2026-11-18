import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { QueryClient } from '@tanstack/svelte-query';
import { resetRateLimit } from '$lib/api/rate-limit';
import { realtimeState } from '$lib/realtime/connection-state.svelte';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import LiveTerminalHost from '$lib/testing/LiveTerminalHost.svelte';
import {
	baseProject,
	DEPLOYMENT_ID,
	PROJECT_ID,
	runningDeployment
} from '../../../../tests/e2e/fixtures/project-detail';

type Handler = (payload: unknown) => void;
const channels = vi.hoisted(() => new Map<string, Set<(payload: unknown) => void>>());

vi.mock('$lib/features/realtime/use-channel.svelte', () => ({
	usePrivateChannel: (_name: unknown, events: Record<string, Handler>) => {
		for (const [name, handler] of Object.entries(events)) {
			if (!channels.has(name)) channels.set(name, new Set());
			channels.get(name)?.add(handler);
		}
	}
}));

vi.mock('$lib/config/public', () => ({ publicConfig: { apiUrl: 'http://api.test' } }));

const FAILED_AT = '2026-11-18T03:00:05.000000Z';
const CAPACITY_SUMMARY = 'Kapasitas server Sakala sedang penuh.';

/** The node had no room to start the container, so the agent refused it after the build. */
const capacityFailure = {
	...runningDeployment,
	status: 'failed',
	finished_at: FAILED_AT,
	failure_code: 'runtime_capacity_exceeded',
	failure_summary: CAPACITY_SUMMARY,
	failure: {
		code: 'runtime_capacity_exceeded',
		category: 'resource',
		summary: CAPACITY_SUMMARY,
		recovery_hint: 'Coba deploy ulang beberapa saat lagi.',
		user_fixable: false,
		detail: null,
		stage: 'deploying'
	}
};

let failed: boolean;
let requests: string[];

/** Settles in microtasks, so fake timers decide when a read lands rather than real I/O. */
function json(body: unknown) {
	return { ok: true, status: 200, headers: new Headers(), json: async () => body } as Response;
}

const emptyPage = {
	data: [],
	links: { first: null, last: null, prev: null, next: null },
	meta: { path: null, per_page: 10, next_cursor: null, prev_cursor: null }
};

function answer(path: string) {
	const deployment = failed ? capacityFailure : { ...runningDeployment, status: 'deploying' };
	if (path.endsWith('/events') || path.endsWith('/logs')) return json(emptyPage);
	if (path.endsWith(`/deployments/${DEPLOYMENT_ID}`)) return json({ data: deployment });
	if (path.endsWith('/deployments')) {
		return json({
			data: [deployment],
			meta: { current_page: 1, from: 1, last_page: 1, per_page: 6, to: 1, total: 1 }
		});
	}
	return json({
		data: {
			...baseProject,
			runtime_status: failed ? 'failed' : 'deploying',
			active_deployment_id: null
		}
	});
}

function emit(name: string, payload: unknown) {
	for (const handler of channels.get(name) ?? []) handler(payload);
}

const shown = (testId: string) =>
	document.querySelector(`[data-testid="${testId}"]`)?.textContent ?? '';

async function openDeploymentPage() {
	await render(QueryTestHost, {
		props: {
			client: new QueryClient({
				defaultOptions: {
					queries: { staleTime: 30_000, retry: false, refetchOnWindowFocus: false }
				}
			}),
			component: LiveTerminalHost,
			props: {
				projectId: PROJECT_ID,
				deploymentId: DEPLOYMENT_ID,
				fallback: { ...baseProject, runtime_status: 'deploying', active_deployment_id: null }
			}
		}
	});
	await vi.advanceTimersByTimeAsync(2_000);
	expect(shown('status')).toBe('deploying');
	expect(shown('redeploy-busy')).toBe('true');
}

/**
 * What `FailAgentCommandAction` broadcasts: the status, with no failure fields and no
 * `project_runtime_status`, then the timeline entry of the same transition.
 */
function broadcastFailure() {
	failed = true;
	emit('.deployment.updated', {
		deployment_id: DEPLOYMENT_ID,
		project_id: PROJECT_ID,
		sequence: 1,
		status: 'failed',
		trigger: 'redeploy',
		branch: 'main',
		commit_sha: runningDeployment.commit_sha,
		commit_message: runningDeployment.commit_message,
		started_at: runningDeployment.started_at,
		finished_at: FAILED_AT
	});
	emit('.deployment.event.created', {
		sequence: 2,
		level: 'error',
		type: 'deployment.failed',
		message: 'Deployment failed.',
		metadata: null,
		occurred_at: FAILED_AT
	});
}

function hideTab() {
	vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
	vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
	document.dispatchEvent(new Event('visibilitychange'));
}

describe('a deployment that fails while its page is open', () => {
	beforeEach(() => {
		channels.clear();
		resetRateLimit();
		failed = false;
		requests = [];
		realtimeState.status = 'connected';
		vi.useFakeTimers({
			toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date']
		});
		vi.stubGlobal(
			'fetch',
			vi.fn(async (input: RequestInfo | URL) => {
				const url = new URL(String(input));
				requests.push(url.pathname);
				return answer(url.pathname);
			})
		);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		resetRateLimit();
		realtimeState.status = 'idle';
	});

	it('reads the failure reason and frees Redeploy in a tab someone is looking at', async () => {
		await openDeploymentPage();

		broadcastFailure();
		await vi.advanceTimersByTimeAsync(2_000);

		expect(shown('status')).toBe('failed');
		expect(shown('failure-code')).toBe('runtime_capacity_exceeded');
		expect(shown('redeploy-busy')).toBe('false');
	});

	it('does the same in a background tab, without waiting to be looked at', async () => {
		await openDeploymentPage();
		hideTab();

		broadcastFailure();
		await vi.advanceTimersByTimeAsync(2_000);

		expect(shown('status')).toBe('failed');
		expect(shown('failure-code')).toBe('runtime_capacity_exceeded');
		expect(shown('redeploy-busy')).toBe('false');
	});

	it('a background tab still reads nothing for a step forward', async () => {
		await openDeploymentPage();
		hideTab();
		const before = requests.length;

		emit('.deployment.updated', {
			deployment_id: DEPLOYMENT_ID,
			sequence: 1,
			status: 'health_checking',
			started_at: runningDeployment.started_at,
			finished_at: null
		});
		await vi.advanceTimersByTimeAsync(5_000);

		expect(shown('status')).toBe('health_checking');
		expect(requests.slice(before)).toEqual([]);
	});
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { QueryClient } from '@tanstack/svelte-query';
import { ApiError } from '$lib/api/errors';
import { resetRateLimit } from '$lib/api/rate-limit';
import { realtimeState } from '$lib/realtime/connection-state.svelte';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import RequestBudgetHost from '$lib/testing/RequestBudgetHost.svelte';
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

const DURATION_S = 300;

/** A 5-minute deployment: how far it is at second `t`. */
const STATUS_TIMELINE: [number, string][] = [
	[0, 'queued'],
	[10, 'cloning'],
	[30, 'analyzing'],
	[60, 'building'],
	[240, 'deploying'],
	[270, 'routing'],
	[285, 'health_checking'],
	[DURATION_S, 'succeeded']
];
const EVENT_EVERY_S = 10;
const LOG_LINES_PER_S = 2;

let startedAt: number;
let requests: { second: number; path: string; status: number }[];
let refuse: ((second: number) => number | null) | null;

const secondNow = () => Math.floor((Date.now() - startedAt) / 1_000);

function statusAt(second: number): string {
	return STATUS_TIMELINE.filter(([at]) => at <= second).at(-1)?.[1] ?? 'queued';
}

function deploymentAt(second: number) {
	const status = statusAt(second);
	return {
		...runningDeployment,
		status,
		queue_state: status === 'queued' ? 'assigned' : null,
		finished_at: status === 'succeeded' ? new Date().toISOString() : null,
		is_active: status === 'succeeded'
	};
}

function eventAt(index: number) {
	return {
		sequence: index + 1,
		level: 'info',
		type: 'deployment.step',
		message: `Langkah ${index + 1}`,
		metadata: [],
		occurred_at: new Date(startedAt + index * EVENT_EVERY_S * 1_000).toISOString()
	};
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json', ...headers }
	});
}

const cursorPage = (data: unknown[], next: string | null = null) => ({
	data,
	links: { first: null, last: null, prev: null, next: null },
	meta: { path: null, per_page: 10, next_cursor: next, prev_cursor: null }
});

function answer(path: string, url: URL, second: number) {
	if (path.endsWith('/events')) {
		const all = Array.from({ length: Math.floor(second / EVENT_EVERY_S) + 1 }, (_, i) =>
			eventAt(i)
		);
		const from = Number(url.searchParams.get('cursor') ?? 0);
		const perPage = Number(url.searchParams.get('per_page') ?? 6);
		const next = from + perPage < all.length ? String(from + perPage) : null;
		return json(cursorPage(all.slice(from, from + perPage), next));
	}
	if (path.endsWith('/logs')) return json(cursorPage([]));
	if (path.endsWith(`/deployments/${DEPLOYMENT_ID}`)) return json({ data: deploymentAt(second) });
	if (path.endsWith('/deployments')) {
		return json({
			data: [deploymentAt(second)],
			meta: { current_page: 1, from: 1, last_page: 1, per_page: 6, to: 1, total: 1 }
		});
	}
	if (path.endsWith('/unread-count')) return json({ data: { count: 0 } });
	return json({
		data: {
			...baseProject,
			runtime_status: second >= DURATION_S ? 'running' : 'deploying',
			active_deployment_id: null
		}
	});
}

function emit(name: string, payload: unknown) {
	for (const handler of channels.get(name) ?? []) handler(payload);
}

async function runDeployment({ realtime }: { realtime: boolean }) {
	realtimeState.status = realtime ? 'connected' : 'unavailable';
	render(QueryTestHost, {
		props: {
			client: new QueryClient({
				defaultOptions: {
					queries: {
						staleTime: 30_000,
						retry: (count, error) =>
							!(error instanceof ApiError && error.isRateLimited) && count < 1,
						refetchOnWindowFocus: false
					}
				}
			}),
			component: RequestBudgetHost,
			props: {
				projectId: PROJECT_ID,
				deploymentId: DEPLOYMENT_ID,
				fallback: { ...baseProject, runtime_status: 'deploying', active_deployment_id: null }
			}
		}
	});

	let sequence = 0;
	let logSequence = 0;
	for (let second = 1; second <= DURATION_S + 30; second++) {
		await vi.advanceTimersByTimeAsync(1_000);
		if (!realtime || second > DURATION_S) continue;

		const status = STATUS_TIMELINE.find(([at]) => at === second)?.[1];
		if (status) {
			const { started_at, finished_at, commit_sha, commit_message } = deploymentAt(second);
			emit('.deployment.updated', {
				deployment_id: DEPLOYMENT_ID,
				project_id: PROJECT_ID,
				sequence: ++sequence,
				status,
				started_at,
				finished_at,
				commit_sha,
				commit_message
			});
		}
		if (second % EVENT_EVERY_S === 0) {
			const event = eventAt(second / EVENT_EVERY_S);
			emit('.deployment.event.created', { ...event, sequence: ++sequence });
		}
		for (let line = 0; line < LOG_LINES_PER_S; line++) {
			emit('.deployment.log.created', {
				sequence: ++sequence,
				log_sequence: ++logSequence,
				stream: 'stdout',
				message: `baris ${logSequence}`,
				recorded_at: new Date().toISOString()
			});
		}
	}
}

function perMinute() {
	const buckets = new Map<number, number>();
	for (const { second } of requests) {
		const minute = Math.floor(second / 60);
		buckets.set(minute, (buckets.get(minute) ?? 0) + 1);
	}
	return [...buckets.values()];
}

/** The API's limit counts over any 60 seconds, so this is the number that has to stay low. */
function busiestMinute() {
	let busiest = 0;
	for (let start = 0; start <= DURATION_S + 30; start++) {
		const inWindow = requests.filter((r) => r.second >= start && r.second < start + 60).length;
		busiest = Math.max(busiest, inWindow);
	}
	return busiest;
}

describe('requests of one tab on a 5-minute deployment', () => {
	beforeEach(() => {
		channels.clear();
		resetRateLimit();
		requests = [];
		refuse = null;
		vi.useFakeTimers({
			toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date']
		});
		startedAt = Date.now();
		vi.stubGlobal(
			'fetch',
			vi.fn(async (input: RequestInfo | URL) => {
				const url = new URL(String(input));
				const second = secondNow();
				const wait = refuse?.(second) ?? null;
				const response =
					wait !== null
						? json({ message: 'Too Many Attempts.' }, 429, { 'Retry-After': String(wait) })
						: answer(url.pathname, url, second);
				requests.push({ second, path: url.pathname, status: response.status });
				return response;
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

	it('stays well under 60 a minute with realtime on', { timeout: 60_000 }, async () => {
		await runDeployment({ realtime: true });

		console.info('[budget] realtime', {
			total: requests.length,
			perMinute: perMinute(),
			busiest60s: busiestMinute()
		});
		expect(busiestMinute()).toBeLessThan(20);
	});

	it('stays under 120 a minute on polling alone', { timeout: 60_000 }, async () => {
		await runDeployment({ realtime: false });

		console.info('[budget] polling', {
			total: requests.length,
			perMinute: perMinute(),
			busiest60s: busiestMinute()
		});
		expect(busiestMinute()).toBeLessThan(120);
	});

	it('a realtime step costs no request of its own', { timeout: 60_000 }, async () => {
		await runDeployment({ realtime: true });

		const whileRunning = requests.filter((r) => r.second > 5 && r.second < DURATION_S);
		// Only the safety polls: deployment, events, and the list, about once a minute each.
		expect(whileRunning.length).toBeLessThanOrEqual(5 * 4);
	});

	it(
		'stays away for as long as Retry-After says, then carries on',
		{ timeout: 60_000 },
		async () => {
			refuse = (second) => (second >= 60 && second < 90 ? 90 - second : null);

			await runDeployment({ realtime: false });

			const refused = requests.filter((r) => r.status === 429);
			console.info('[budget] 429s', refused.length);
			expect(refused.length).toBe(1);
			expect(requests.filter((r) => r.second > refused[0].second && r.second < 90)).toEqual([]);
			expect(requests.some((r) => r.second >= 90 && r.status === 200)).toBe(true);
		}
	);

	it(
		'a background tab polls nothing, and realtime events cost nothing',
		{ timeout: 60_000 },
		async () => {
			vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
			vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
			document.dispatchEvent(new Event('visibilitychange'));

			await runDeployment({ realtime: true });

			const afterLoad = requests.filter((r) => r.second > 5);
			console.info('[budget] hidden', afterLoad.length, JSON.stringify(afterLoad));
			expect(afterLoad).toEqual([]);
		}
	);
});

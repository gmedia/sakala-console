import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InfiniteQueryObserver, QueryClient } from '@tanstack/svelte-query';
import { apiErrorFromResponse } from '$lib/api/errors';
import { queryKeys } from '$lib/api/query-keys';
import { getDeploymentLogs, type DeploymentLogsResponse } from '$lib/api/resources/deployment';
import { realtimeState } from '$lib/realtime/connection-state.svelte';
import {
	flattenLogPages,
	LOG_MAX_LINES,
	LOG_MAX_PAGES,
	LOG_PAGE_SIZE,
	type DeploymentLogLine,
	type DeploymentLogsCache
} from './deployment-logs';
import {
	applyRealtimeLogLine,
	deploymentLogsQueryOptions,
	FALLBACK_POLLING_INTERVAL_MS,
	refreshDeploymentLogsTail,
	resolveLogTailInterval,
	resolveRefetchInterval
} from './queries';

vi.mock('$lib/api/resources/deployment', () => ({
	getDeployment: vi.fn(),
	getAllDeploymentEvents: vi.fn(),
	getDeploymentLogs: vi.fn(),
	DeploymentEventsTruncationError: class extends Error {}
}));

vi.mock('$lib/realtime/connection-state.svelte', () => ({
	realtimeState: { status: 'disconnected' }
}));

const mockGetLogs = vi.mocked(getDeploymentLogs);

function line(sequence: number): DeploymentLogLine {
	return {
		sequence,
		stream: 'stdout',
		message: `baris ${sequence}`,
		recorded_at: '2026-09-20T08:41:02.000000Z'
	};
}

/** Serves a log the way the API does with order=desc: newest first, cursor is the page number. */
function serveLog(total: () => number) {
	mockGetLogs.mockImplementation(async (_project, _deployment, params) => {
		const pageIndex = Number(params?.cursor ?? 0);
		const start = total() - pageIndex * LOG_PAGE_SIZE;
		const end = Math.max(start - LOG_PAGE_SIZE, 0);
		const data = [];
		for (let sequence = start; sequence > end; sequence -= 1) data.push(line(sequence));

		return {
			data,
			links: { first: null, last: null, prev: null, next: null },
			meta: {
				path: null,
				per_page: LOG_PAGE_SIZE,
				next_cursor: end > 0 ? String(pageIndex + 1) : null,
				prev_cursor: pageIndex > 0 ? String(pageIndex - 1) : null
			}
		} satisfies DeploymentLogsResponse;
	});
}

const options = () => deploymentLogsQueryOptions('proj_1', 'dep_1');
const key = queryKeys.deployments.logs('dep_1');

let client: QueryClient;

beforeEach(() => {
	vi.clearAllMocks();
	realtimeState.status = 'disconnected';
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

function cachedSequences() {
	const data = client.getQueryData<DeploymentLogsCache>(key);
	return flattenLogPages(data?.pages ?? []).map((item) => item.sequence);
}

describe('deploymentLogsQueryOptions', () => {
	it('asks for the newest lines first, in the largest page the API accepts', async () => {
		serveLog(() => 3);

		await client.fetchInfiniteQuery(options());

		expect(mockGetLogs).toHaveBeenCalledWith('proj_1', 'dep_1', {
			cursor: undefined,
			per_page: 200,
			order: 'desc'
		});
		expect(cachedSequences()).toEqual([1, 2, 3]);
	});

	it('shows the final lines of a long log after one request, however long it is', async () => {
		const total = 50_000;
		serveLog(() => total);

		await client.fetchInfiniteQuery(options());

		expect(mockGetLogs).toHaveBeenCalledTimes(1);
		expect(cachedSequences().at(-1)).toBe(total);
		expect(cachedSequences()).toHaveLength(LOG_PAGE_SIZE);
	});

	it('walks back through older lines, with memory bounded', async () => {
		const total = LOG_MAX_LINES + LOG_PAGE_SIZE;
		serveLog(() => total);

		await client.fetchInfiniteQuery({ ...options(), pages: LOG_MAX_PAGES });
		let sequences = cachedSequences();
		expect(sequences).toHaveLength(LOG_MAX_LINES);
		expect(sequences.at(-1)).toBe(total);

		await new InfiniteQueryObserver(client, options()).fetchNextPage();

		sequences = cachedSequences();
		expect(sequences).toHaveLength(LOG_MAX_LINES);
		expect(sequences[0]).toBe(1);
		expect(sequences.at(-1)).toBe(total - LOG_PAGE_SIZE);
	});
});

describe('refreshDeploymentLogsTail', () => {
	it('reads the newest lines and merges them without duplicates', async () => {
		let total = 13;
		serveLog(() => total);
		await client.fetchInfiniteQuery(options());
		mockGetLogs.mockClear();

		total = 16;
		const refreshed = await refreshDeploymentLogsTail(client, 'proj_1', 'dep_1');

		expect(refreshed).toBe(true);
		expect(mockGetLogs).toHaveBeenCalledTimes(1);
		expect(mockGetLogs).toHaveBeenCalledWith('proj_1', 'dep_1', { per_page: 200, order: 'desc' });
		expect(cachedSequences()).toEqual(Array.from({ length: 16 }, (_, index) => index + 1));
	});

	it('spends no request before history exists', async () => {
		expect(await refreshDeploymentLogsTail(client, 'proj_1', 'dep_1')).toBe(false);
		expect(mockGetLogs).not.toHaveBeenCalled();
	});

	it('leaves a reader alone in a window without the newest page, unless forced', async () => {
		serveLog(() => 500);
		client.setQueryData<DeploymentLogsCache>(key, {
			pages: [
				{
					data: [line(100)],
					links: { first: null, last: null, prev: null, next: null },
					meta: { path: null, per_page: 200, next_cursor: null, prev_cursor: 'p' }
				}
			],
			pageParams: ['older']
		});

		expect(await refreshDeploymentLogsTail(client, 'proj_1', 'dep_1')).toBe(false);
		expect(mockGetLogs).not.toHaveBeenCalled();

		expect(await refreshDeploymentLogsTail(client, 'proj_1', 'dep_1', { force: true })).toBe(true);
		expect(cachedSequences().at(-1)).toBe(500);
	});
});

describe('applyRealtimeLogLine', () => {
	async function seed(total: number) {
		serveLog(() => total);
		await client.fetchInfiniteQuery(options());
		mockGetLogs.mockClear();
	}

	it('appends the next line without a request', async () => {
		await seed(3);

		expect(applyRealtimeLogLine(client, 'dep_1', line(4), { canEvict: true })).toBe('applied');

		expect(cachedSequences()).toEqual([1, 2, 3, 4]);
		expect(mockGetLogs).not.toHaveBeenCalled();
	});

	it('dedupes a line the fetch already returned', async () => {
		await seed(3);

		applyRealtimeLogLine(client, 'dep_1', line(3), { canEvict: true });

		expect(cachedSequences()).toEqual([1, 2, 3]);
	});

	it('asks for the tail when a line skips ahead', async () => {
		await seed(3);

		expect(applyRealtimeLogLine(client, 'dep_1', line(9), { canEvict: true })).toBe('needs-tail');
	});

	it('waits for history instead of building a cache of its own', () => {
		expect(applyRealtimeLogLine(client, 'dep_1', line(1), { canEvict: true })).toBe('ignored');
		expect(client.getQueryData(key)).toBeUndefined();
	});

	it('at the bound, restarts for a follower but not under someone reading', async () => {
		const full = Array.from({ length: LOG_MAX_LINES }, (_, index) => line(index + 1));
		client.setQueryData<DeploymentLogsCache>(key, {
			pages: [
				{
					data: full,
					links: { first: null, last: null, prev: null, next: null },
					meta: { path: null, per_page: 200, next_cursor: null, prev_cursor: null }
				}
			],
			pageParams: [null]
		});
		const next = line(LOG_MAX_LINES + 1);

		expect(applyRealtimeLogLine(client, 'dep_1', next, { canEvict: true })).toBe('needs-tail');
		expect(applyRealtimeLogLine(client, 'dep_1', next, { canEvict: false })).toBe('ignored');
		expect(cachedSequences()).toHaveLength(LOG_MAX_LINES);
	});
});

describe('polling and the rate limit', () => {
	it('polls the tail only while realtime is down', () => {
		expect(resolveLogTailInterval(false)).toBe(FALLBACK_POLLING_INTERVAL_MS);

		realtimeState.status = 'connected';
		expect(resolveLogTailInterval(false)).toBe(false);
	});

	it('stops once the deployment has finished', () => {
		expect(resolveLogTailInterval(true)).toBe(false);
	});

	it('waits out Retry-After instead of polling on schedule', () => {
		const limited = apiErrorFromResponse(429, { retryAfterSeconds: 42 });

		expect(resolveLogTailInterval(false, limited)).toBe(42_000);
		expect(resolveRefetchInterval(false, limited)).toBe(42_000);
	});
});

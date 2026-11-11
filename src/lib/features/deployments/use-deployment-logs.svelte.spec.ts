import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { usePrivateChannel } from '$lib/features/realtime/use-channel.svelte';
import {
	applyRealtimeLogLine,
	createDeploymentLogsQuery,
	createDeploymentLogsTailQuery,
	refreshDeploymentLogsTail
} from './queries';
import { useDeploymentLogs } from './use-deployment-logs.svelte';
import { LOG_REALTIME_COALESCE_MS } from './deployment-logs';

const client = vi.hoisted(() => ({ marker: 'client' }));

vi.mock('@tanstack/svelte-query', () => ({
	useQueryClient: () => client
}));

vi.mock('$lib/features/realtime/use-channel.svelte', () => ({
	usePrivateChannel: vi.fn()
}));

vi.mock('./queries', () => ({
	applyRealtimeLogLine: vi.fn(() => 'applied'),
	createDeploymentLogsQuery: vi.fn(),
	createDeploymentLogsTailQuery: vi.fn(),
	refreshDeploymentLogsTail: vi.fn(async () => true)
}));

const LOG_EVENT = '.deployment.log.created';

const broadcast = (logSequence: number) => ({
	sequence: logSequence + 100,
	log_sequence: logSequence,
	stream: 'stdout',
	message: `baris ${logSequence}`,
	recorded_at: '2026-09-20T08:41:02.000000Z'
});

function logsQueryStub(overrides: Record<string, unknown> = {}) {
	const state = $state({
		data: undefined as unknown,
		isPending: false,
		isError: false,
		error: null as unknown,
		isFetching: false,
		isFetchingNextPage: false,
		isFetchNextPageError: false,
		hasNextPage: false,
		...overrides
	});

	return Object.assign(state, {
		fetchNextPage: vi.fn().mockResolvedValue(undefined),
		refetch: vi.fn().mockResolvedValue(undefined)
	});
}

let logsQuery: ReturnType<typeof logsQueryStub>;
let tailRefetch: ReturnType<typeof vi.fn>;
let handlers: Record<string, (payload: unknown) => void>;
let destroy: () => void;

function setup(isTerminal: () => boolean = () => false) {
	let logs!: ReturnType<typeof useDeploymentLogs>;
	destroy = $effect.root(() => {
		logs = useDeploymentLogs(
			() => 'proj_1',
			() => 'dep_1',
			isTerminal
		);
	});
	flushSync();
	return logs;
}

beforeEach(() => {
	vi.useFakeTimers();
	logsQuery = logsQueryStub();
	tailRefetch = vi.fn().mockResolvedValue(undefined);
	handlers = {};

	vi.mocked(createDeploymentLogsQuery).mockReturnValue(logsQuery as never);
	vi.mocked(createDeploymentLogsTailQuery).mockReturnValue({
		refetch: tailRefetch,
		isError: false,
		error: null,
		isFetching: false
	} as never);
	vi.mocked(usePrivateChannel).mockImplementation((_name, events) => {
		Object.assign(handlers, events);
	});
});

afterEach(() => {
	destroy?.();
	vi.useRealTimers();
	vi.clearAllMocks();
	vi.mocked(applyRealtimeLogLine).mockReturnValue('applied');
});

describe('realtime', () => {
	it('subscribes to the deployment channel', () => {
		setup();

		const [channel] = vi.mocked(usePrivateChannel).mock.calls[0];
		expect((channel as () => string)()).toBe('deployment.dep_1');
		expect(handlers[LOG_EVENT]).toBeTypeOf('function');
	});

	it('uses log_sequence, not the realtime counter, to place the line', () => {
		setup();

		handlers[LOG_EVENT](broadcast(7));

		expect(applyRealtimeLogLine).toHaveBeenCalledWith(
			client,
			'dep_1',
			{
				sequence: 7,
				stream: 'stdout',
				message: 'baris 7',
				recorded_at: '2026-09-20T08:41:02.000000Z'
			},
			{ canEvict: true }
		);
	});

	it('spends no request on lines that arrive in order', async () => {
		setup();

		for (let sequence = 1; sequence <= 500; sequence += 1) handlers[LOG_EVENT](broadcast(sequence));
		await vi.advanceTimersByTimeAsync(LOG_REALTIME_COALESCE_MS * 2);

		expect(tailRefetch).not.toHaveBeenCalled();
	});

	it('reads the tail once for a burst of gaps', async () => {
		vi.mocked(applyRealtimeLogLine).mockReturnValue('needs-tail');
		setup();

		for (let sequence = 1; sequence <= 500; sequence += 1) handlers[LOG_EVENT](broadcast(sequence));
		await vi.advanceTimersByTimeAsync(LOG_REALTIME_COALESCE_MS);

		expect(tailRefetch).toHaveBeenCalledTimes(1);
		expect(tailRefetch).toHaveBeenCalledWith({ cancelRefetch: false });
	});

	it('reads the tail when a payload cannot be used', async () => {
		setup();

		handlers[LOG_EVENT]({ sequence: 1, message: 'tanpa log_sequence' });
		await vi.advanceTimersByTimeAsync(LOG_REALTIME_COALESCE_MS);

		expect(applyRealtimeLogLine).not.toHaveBeenCalled();
		expect(tailRefetch).toHaveBeenCalledTimes(1);
	});

	it('does not evict lines under someone who stopped following', () => {
		const logs = setup();
		logs.pause();

		handlers[LOG_EVENT](broadcast(1));

		expect(vi.mocked(applyRealtimeLogLine).mock.calls[0][3]).toEqual({ canEvict: false });
	});

	it('stops a pending tail read on destroy', async () => {
		vi.mocked(applyRealtimeLogLine).mockReturnValue('needs-tail');
		setup();

		handlers[LOG_EVENT](broadcast(1));
		destroy();
		await vi.advanceTimersByTimeAsync(LOG_REALTIME_COALESCE_MS);

		expect(tailRefetch).not.toHaveBeenCalled();
	});
});

describe('terminal transition', () => {
	it('reads the tail once when the deployment finishes', () => {
		vi.useFakeTimers();
		let terminal = $state(false);
		setup(() => terminal);
		expect(tailRefetch).not.toHaveBeenCalled();

		terminal = true;
		flushSync();
		vi.advanceTimersByTime(5_000);

		expect(tailRefetch).toHaveBeenCalledTimes(1);
		vi.useRealTimers();
	});

	it('does not read the tail for a deployment that was already finished', () => {
		setup(() => true);

		expect(tailRefetch).not.toHaveBeenCalled();
	});
});

describe('history', () => {
	it('fetches nothing beyond the first page on its own', () => {
		logsQuery.hasNextPage = true;
		setup();

		expect(logsQuery.fetchNextPage).not.toHaveBeenCalled();
	});

	it('loads older lines on request, and stops following to keep the reader in place', () => {
		logsQuery.hasNextPage = true;
		const logs = setup();

		logs.loadOlder();

		expect(logsQuery.fetchNextPage).toHaveBeenCalledTimes(1);
		expect(logs.following).toBe(false);
	});

	it('offers newer lines only once the newest page has been evicted', () => {
		logsQuery.data = { pages: [{ data: [] }], pageParams: [null] };
		const logs = setup();
		expect(logs.hasNewerPages).toBe(false);

		logsQuery.data = { pages: [{ data: [] }], pageParams: ['older'] };
		flushSync();
		expect(logs.hasNewerPages).toBe(true);

		logs.goToLatest();
		expect(refreshDeploymentLogsTail).toHaveBeenCalledWith(client, 'proj_1', 'dep_1', {
			force: true
		});
	});
});

describe('user controls', () => {
	it('pausing stops following until the user asks for the latest', () => {
		const logs = setup();

		logs.pause();
		expect(logs.following).toBe(false);
		expect(logs.paused).toBe(true);

		logs.goToLatest();
		expect(logs.following).toBe(true);
		expect(logs.paused).toBe(false);
		expect(refreshDeploymentLogsTail).not.toHaveBeenCalled();
	});

	it.each([
		['the older page', { isError: true, isFetchNextPageError: true }, 'fetchNextPage'],
		['the first page', { isError: true }, 'refetch']
	] as const)('retry repeats %s', (_name, state, method) => {
		Object.assign(logsQuery, state);
		const logs = setup();

		logs.retry();

		expect(logsQuery[method]).toHaveBeenCalledTimes(1);
	});

	it('retry reads the tail when only the refresh failed', () => {
		const logs = setup();

		logs.retry();

		expect(tailRefetch).toHaveBeenCalledTimes(1);
	});
});

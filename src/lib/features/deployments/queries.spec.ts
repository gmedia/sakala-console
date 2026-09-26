import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQuery } from '@tanstack/svelte-query';
import { queryKeys } from '$lib/api/query-keys';
import {
	getDeployment,
	getAllDeploymentEvents,
	DeploymentEventsTruncationError
} from '$lib/api/resources/deployment';
import { realtimeState } from '$lib/realtime/connection-state.svelte';
import { TERMINAL_STATUSES } from './deployment-presentation';
import {
	createDeploymentQuery,
	createDeploymentEventsQuery,
	resolveRefetchInterval
} from './queries';

const REALTIME_CONNECTED_SAFETY_POLL_MS = 10_000;
const FALLBACK_POLLING_INTERVAL_MS = 5_000;

vi.mock('@tanstack/svelte-query', () => ({
	createQuery: vi.fn((factory) => factory())
}));

vi.mock('$lib/api/query-keys', () => ({
	queryKeys: {
		deployments: {
			detail: vi.fn((project: string, deployment: string) => [
				'deployments',
				'detail',
				project,
				deployment
			]),
			events: vi.fn((project: string, deployment: string) => [
				'deployments',
				'events',
				project,
				deployment
			])
		}
	}
}));

vi.mock('$lib/api/resources/deployment', () => ({
	getDeployment: vi.fn(),
	getAllDeploymentEvents: vi.fn(),
	DeploymentEventsTruncationError: class DeploymentEventsTruncationError extends Error {
		readonly name = 'DeploymentEventsTruncationError';
		readonly isRetryable = false;
		constructor(
			public readonly deploymentId: string,
			public readonly pagesFetched: number,
			public readonly eventsFetched: number,
			public readonly remainingCursor: string
		) {
			super('truncated');
		}
	}
}));

vi.mock('$lib/realtime/connection-state.svelte', () => ({
	realtimeState: { status: 'disconnected' }
}));

const mockCreateQuery = vi.mocked(createQuery);
const mockGetDeployment = vi.mocked(getDeployment);
const mockGetAllDeploymentEvents = vi.mocked(getAllDeploymentEvents);
const mockRealtimeState = vi.mocked(realtimeState, true);

function captureQueryConfig<T>(fn: () => unknown): T {
	mockCreateQuery.mockClear();
	fn();
	const call = mockCreateQuery.mock.calls[0];
	const factory = call?.[0] as unknown as () => T;
	return factory();
}

function makeQueryState(status?: string, queryStatus: 'success' | 'error' = 'success') {
	return {
		state: {
			status: queryStatus,
			data: status ? { data: { status } } : undefined
		}
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	mockRealtimeState.status = 'disconnected';
});

describe('createDeploymentQuery', () => {
	it('menghasilkan queryKey dari queryKeys.deployments.detail', () => {
		const config = captureQueryConfig<{ queryKey: unknown }>(() =>
			createDeploymentQuery(
				() => 'proj_1',
				() => 'dep_1'
			)
		);

		expect(queryKeys.deployments.detail).toHaveBeenCalledWith('proj_1', 'dep_1');
		expect(config.queryKey).toEqual(['deployments', 'detail', 'proj_1', 'dep_1']);
	});

	it('queryFn memanggil getDeployment(project, deployment)', () => {
		const config = captureQueryConfig<{ queryFn: () => unknown }>(() =>
			createDeploymentQuery(
				() => 'proj_1',
				() => 'dep_1'
			)
		);

		config.queryFn();
		expect(mockGetDeployment).toHaveBeenCalledWith('proj_1', 'dep_1');
	});

	it('enabled = true ketika project dan deployment terisi', () => {
		const config = captureQueryConfig<{ enabled: boolean }>(() =>
			createDeploymentQuery(
				() => 'proj_1',
				() => 'dep_1'
			)
		);
		expect(config.enabled).toBe(true);
	});

	it('enabled = false ketika project kosong', () => {
		const config = captureQueryConfig<{ enabled: boolean }>(() =>
			createDeploymentQuery(
				() => '',
				() => 'dep_1'
			)
		);
		expect(config.enabled).toBe(false);
	});

	it('enabled = false ketika deployment kosong', () => {
		const config = captureQueryConfig<{ enabled: boolean }>(() =>
			createDeploymentQuery(
				() => 'proj_1',
				() => ''
			)
		);
		expect(config.enabled).toBe(false);
	});

	describe('refetchInterval', () => {
		type RefetchFn = (query: unknown) => number | false;

		it('mengembalikan false ketika status terminal', () => {
			const terminalStatus = [...TERMINAL_STATUSES][0];
			const config = captureQueryConfig<{ refetchInterval: RefetchFn }>(() =>
				createDeploymentQuery(
					() => 'p',
					() => 'd'
				)
			);

			const result = config.refetchInterval(makeQueryState(terminalStatus));
			expect(result).toBe(false);
		});

		it('mengembalikan false ketika status terminal walaupun realtime disconnected', () => {
			mockRealtimeState.status = 'disconnected';
			const terminalStatus = [...TERMINAL_STATUSES][0];
			const config = captureQueryConfig<{ refetchInterval: RefetchFn }>(() =>
				createDeploymentQuery(
					() => 'p',
					() => 'd'
				)
			);

			const result = config.refetchInterval(makeQueryState(terminalStatus));
			expect(result).toBe(false);
		});

		it('mengembalikan safety poll (10s) ketika realtime terhubung & non-terminal', () => {
			mockRealtimeState.status = 'connected';
			const config = captureQueryConfig<{ refetchInterval: RefetchFn }>(() =>
				createDeploymentQuery(
					() => 'p',
					() => 'd'
				)
			);

			const result = config.refetchInterval(makeQueryState('running'));
			expect(result).toBe(REALTIME_CONNECTED_SAFETY_POLL_MS);
		});

		it('mengembalikan fallback poll (5s) ketika status non-terminal & realtime disconnected', () => {
			mockRealtimeState.status = 'disconnected';
			const config = captureQueryConfig<{ refetchInterval: RefetchFn }>(() =>
				createDeploymentQuery(
					() => 'p',
					() => 'd'
				)
			);

			const result = config.refetchInterval(makeQueryState('running'));
			expect(result).toBe(FALLBACK_POLLING_INTERVAL_MS);
		});

		it('mengembalikan fallback poll (5s) ketika data belum ada & realtime disconnected', () => {
			mockRealtimeState.status = 'disconnected';
			const config = captureQueryConfig<{ refetchInterval: RefetchFn }>(() =>
				createDeploymentQuery(
					() => 'p',
					() => 'd'
				)
			);

			const result = config.refetchInterval(makeQueryState(undefined));
			expect(result).toBe(FALLBACK_POLLING_INTERVAL_MS);
		});

		it('mengembalikan safety poll (10s) ketika data belum ada tapi realtime connected', () => {
			mockRealtimeState.status = 'connected';
			const config = captureQueryConfig<{ refetchInterval: RefetchFn }>(() =>
				createDeploymentQuery(
					() => 'p',
					() => 'd'
				)
			);

			const result = config.refetchInterval(makeQueryState(undefined));
			expect(result).toBe(REALTIME_CONNECTED_SAFETY_POLL_MS);
		});
	});
});

describe('createDeploymentEventsQuery', () => {
	it('menghasilkan queryKey dari queryKeys.deployments.events', () => {
		const config = captureQueryConfig<{ queryKey: unknown }>(() =>
			createDeploymentEventsQuery(
				() => 'proj_1',
				() => 'dep_1',
				() => false
			)
		);

		expect(queryKeys.deployments.events).toHaveBeenCalledWith('proj_1', 'dep_1');
		expect(config.queryKey).toEqual(['deployments', 'events', 'proj_1', 'dep_1']);
	});

	it('queryFn memanggil getAllDeploymentEvents(project, deployment)', () => {
		const config = captureQueryConfig<{ queryFn: () => unknown }>(() =>
			createDeploymentEventsQuery(
				() => 'proj_1',
				() => 'dep_1',
				() => false
			)
		);

		config.queryFn();
		expect(mockGetAllDeploymentEvents).toHaveBeenCalledWith('proj_1', 'dep_1');
	});

	it('enabled = true ketika project dan deployment terisi', () => {
		const config = captureQueryConfig<{ enabled: boolean }>(() =>
			createDeploymentEventsQuery(
				() => 'proj_1',
				() => 'dep_1',
				() => false
			)
		);
		expect(config.enabled).toBe(true);
	});

	it('enabled = false ketika salah satu id kosong', () => {
		const config1 = captureQueryConfig<{ enabled: boolean }>(() =>
			createDeploymentEventsQuery(
				() => '',
				() => 'dep_1',
				() => false
			)
		);
		const config2 = captureQueryConfig<{ enabled: boolean }>(() =>
			createDeploymentEventsQuery(
				() => 'proj_1',
				() => '',
				() => false
			)
		);
		expect(config1.enabled).toBe(false);
		expect(config2.enabled).toBe(false);
	});

	describe('retry', () => {
		type RetryFn = (failureCount: number, error: unknown) => boolean;

		it('TIDAK retry ketika error adalah DeploymentEventsTruncationError', () => {
			const config = captureQueryConfig<{ retry: RetryFn }>(() =>
				createDeploymentEventsQuery(
					() => 'p',
					() => 'd',
					() => false
				)
			);

			const truncationError = new DeploymentEventsTruncationError('dep_1', 50, 300, 'cursor_x');

			expect(config.retry(0, truncationError)).toBe(false);
			expect(config.retry(1, truncationError)).toBe(false);
			expect(config.retry(2, truncationError)).toBe(false);
			expect(config.retry(3, truncationError)).toBe(false);
		});

		it('retry untuk error generik sampai 3x', () => {
			const config = captureQueryConfig<{ retry: RetryFn }>(() =>
				createDeploymentEventsQuery(
					() => 'p',
					() => 'd',
					() => false
				)
			);

			const networkError = new Error('Network error');

			expect(config.retry(0, networkError)).toBe(true);
			expect(config.retry(1, networkError)).toBe(true);
			expect(config.retry(2, networkError)).toBe(true);
			expect(config.retry(3, networkError)).toBe(false); // max 3
		});

		it('retry untuk ApiError 500 (transient)', () => {
			const config = captureQueryConfig<{ retry: RetryFn }>(() =>
				createDeploymentEventsQuery(
					() => 'p',
					() => 'd',
					() => false
				)
			);

			const serverError = new Error('500 Server Error');

			expect(config.retry(0, serverError)).toBe(true);
			expect(config.retry(2, serverError)).toBe(true);
			expect(config.retry(3, serverError)).toBe(false);
		});

		it('retry untuk ZodError (mungkin transient jika data berubah)', () => {
			const config = captureQueryConfig<{ retry: RetryFn }>(() =>
				createDeploymentEventsQuery(
					() => 'p',
					() => 'd',
					() => false
				)
			);

			const zodError = new Error('ZodError: ...');

			expect(config.retry(0, zodError)).toBe(true);
			expect(config.retry(3, zodError)).toBe(false);
		});

		it('hanya TruncationError yang non-retryable, error lain tetap retry', () => {
			const config = captureQueryConfig<{ retry: RetryFn }>(() =>
				createDeploymentEventsQuery(
					() => 'p',
					() => 'd',
					() => false
				)
			);

			const truncationError = new DeploymentEventsTruncationError('d', 50, 300, 'cursor_x');
			const networkError = new Error('Network error');

			expect(config.retry(0, truncationError)).toBe(false);
			expect(config.retry(1, truncationError)).toBe(false);

			expect(config.retry(0, networkError)).toBe(true);
			expect(config.retry(1, networkError)).toBe(true);
			expect(config.retry(2, networkError)).toBe(true);
			expect(config.retry(3, networkError)).toBe(false);
		});
	});

	describe('refetchInterval', () => {
		type RefetchFn = () => number | false;

		it('mengembalikan false ketika isTerminal() = true', () => {
			const config = captureQueryConfig<{ refetchInterval: RefetchFn }>(() =>
				createDeploymentEventsQuery(
					() => 'p',
					() => 'd',
					() => true
				)
			);

			expect(config.refetchInterval()).toBe(false);
		});

		it('mengembalikan safety poll (10s) ketika realtime terhubung & belum terminal', () => {
			mockRealtimeState.status = 'connected';
			const config = captureQueryConfig<{ refetchInterval: RefetchFn }>(() =>
				createDeploymentEventsQuery(
					() => 'p',
					() => 'd',
					() => false
				)
			);

			expect(config.refetchInterval()).toBe(REALTIME_CONNECTED_SAFETY_POLL_MS);
		});

		it('mengembalikan fallback poll (5s) ketika belum terminal & realtime disconnected', () => {
			mockRealtimeState.status = 'disconnected';
			const config = captureQueryConfig<{ refetchInterval: RefetchFn }>(() =>
				createDeploymentEventsQuery(
					() => 'p',
					() => 'd',
					() => false
				)
			);

			expect(config.refetchInterval()).toBe(FALLBACK_POLLING_INTERVAL_MS);
		});

		it('mengembalikan false ketika terminal walaupun realtime connected', () => {
			mockRealtimeState.status = 'connected';
			const config = captureQueryConfig<{ refetchInterval: RefetchFn }>(() =>
				createDeploymentEventsQuery(
					() => 'p',
					() => 'd',
					() => true
				)
			);

			expect(config.refetchInterval()).toBe(false);
		});

		it('memanggil isTerminal() setiap kali refetchInterval dievaluasi', () => {
			const isTerminal = vi.fn(() => false);
			const config = captureQueryConfig<{ refetchInterval: RefetchFn }>(() =>
				createDeploymentEventsQuery(
					() => 'p',
					() => 'd',
					isTerminal
				)
			);

			config.refetchInterval();
			config.refetchInterval();
			config.refetchInterval();

			expect(isTerminal).toHaveBeenCalledTimes(3);
		});
	});

	describe('resolveRefetchInterval', () => {
		it('mengembalikan false saat terminal, tanpa peduli status koneksi', () => {
			for (const status of ['connected', 'disconnected', 'unavailable', 'failed'] as const) {
				mockRealtimeState.status = status;
				expect(resolveRefetchInterval(true)).toBe(false);
			}
		});

		it('mengembalikan safety poll (10s) hanya saat realtime connected', () => {
			mockRealtimeState.status = 'connected';
			expect(resolveRefetchInterval(false)).toBe(REALTIME_CONNECTED_SAFETY_POLL_MS);
		});

		it.each(['idle', 'connecting', 'disconnected', 'unavailable', 'failed'] as const)(
			'mengembalikan fallback poll (5s) saat realtime %s',
			(status) => {
				mockRealtimeState.status = status;
				expect(resolveRefetchInterval(false)).toBe(FALLBACK_POLLING_INTERVAL_MS);
			}
		);
	});
});

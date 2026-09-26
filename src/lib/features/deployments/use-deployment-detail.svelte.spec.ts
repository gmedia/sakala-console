import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useDeploymentDetail } from './use-deployment-detail.svelte';
import { usePrivateChannel } from '$lib/features/realtime/use-channel.svelte';
import { createDeploymentQuery, createDeploymentEventsQuery } from './queries';
import { createQuery } from '@tanstack/svelte-query';
import { ApiError, NetworkError } from '$lib/api/errors';

const { mockGuardAccept } = vi.hoisted(() => ({
	mockGuardAccept: vi.fn((seq: number) => {
		void seq;
		return true;
	})
}));

vi.mock('$lib/features/realtime/use-channel.svelte', () => ({
	usePrivateChannel: vi.fn()
}));

vi.mock('$lib/features/realtime/sequence-guard', () => ({
	SequenceGuard: class {
		constructor(_initialSequence: number = 0) {
			void _initialSequence;
		}

		accept(seq: number): boolean {
			return mockGuardAccept(seq);
		}

		getSequence(): number {
			return 0;
		}

		reset(_sequence: number = 0): void {
			void _sequence;
		}
	}
}));

vi.mock('./queries', () => ({
	createDeploymentQuery: vi.fn(),
	createDeploymentEventsQuery: vi.fn()
}));

vi.mock('@tanstack/svelte-query', () => ({
	createQuery: vi.fn((factory) => factory())
}));

vi.mock('$lib/features/projects/api', () => ({
	getProject: vi.fn()
}));

vi.mock('$lib/api/query-keys', () => ({
	queryKeys: {
		projects: {
			detail: vi.fn((id: string) => ['projects', 'detail', id])
		}
	}
}));

const mockUsePrivateChannel = vi.mocked(usePrivateChannel);
const mockCreateDeploymentQuery = vi.mocked(createDeploymentQuery);
const mockCreateDeploymentEventsQuery = vi.mocked(createDeploymentEventsQuery);
const mockCreateQuery = vi.mocked(createQuery);

function makeDeploymentQuery(overrides = {}) {
	return {
		data: undefined,
		isPending: false,
		isError: false,
		error: null,
		refetch: vi.fn(),
		...overrides
	};
}

function makeDeployment(overrides = {}) {
	return {
		id: 'dep_1',
		project_id: 'proj_1',
		sequence: 1,
		branch: 'main',
		status: 'succeeded',
		trigger: 'manual',
		commit_sha: 'abc',
		commit_message: 'msg',
		image_reference: null,
		requested_resources: null,
		effective_resources: null,
		applied_resources: null,
		finalization_deferred: false,
		finalization_deferred_reason: '',
		agent_node_id: null,
		started_at: '2026-09-20T10:00:00Z',
		finished_at: '2026-09-20T10:01:00Z',
		cancelled_at: null,
		failure_code: null,
		failure_summary: null,
		failure: null,
		created_at: '2026-09-20T10:00:00Z',
		updated_at: '2026-09-20T10:01:00Z',
		...overrides
	};
}

function makeProject(overrides = {}) {
	return {
		id: 'proj_1',
		name: 'Test',
		slug: 'test',
		default_domain: 'test.run.staging.sakala.dev',
		...overrides
	};
}

function runComposable(projectId = 'proj_1', deploymentId = 'dep_1') {
	let detail!: ReturnType<typeof useDeploymentDetail>;

	const destroy = $effect.root(() => {
		detail = useDeploymentDetail(
			() => projectId,
			() => deploymentId
		);
	});

	return { detail, destroy };
}

let capturedHandlers: Record<string, (payload: unknown) => void>;

beforeEach(() => {
	vi.clearAllMocks();
	capturedHandlers = {};

	mockGuardAccept.mockReset();
	mockGuardAccept.mockReturnValue(true);

	mockUsePrivateChannel.mockImplementation((channelName, events) => {
		for (const [event, handler] of Object.entries(events)) {
			capturedHandlers[event] = handler;
		}
		void channelName;
	});

	mockCreateDeploymentQuery.mockReturnValue(makeDeploymentQuery() as never);
	mockCreateDeploymentEventsQuery.mockReturnValue(makeDeploymentQuery() as never);
	mockCreateQuery.mockReturnValue({ data: undefined } as never);
});

afterEach(() => {
	vi.clearAllMocks();
});

describe('useDeploymentDetail', () => {
	it('membuat deploymentQuery dan deploymentEventsQuery', () => {
		const { detail, destroy } = runComposable();

		expect(mockCreateDeploymentQuery).toHaveBeenCalledTimes(1);
		expect(mockCreateDeploymentEventsQuery).toHaveBeenCalledTimes(1);
		expect(detail.deploymentQuery).toBeDefined();
		expect(detail.deploymentEventsQuery).toBeDefined();

		destroy();
	});

	it('mendaftarkan private channel dengan nama deployment.<id>', () => {
		const { destroy } = runComposable('proj_1', 'dep_abc');

		expect(mockUsePrivateChannel).toHaveBeenCalledTimes(1);
		const [channelNameFn] = mockUsePrivateChannel.mock.calls[0];
		expect(typeof channelNameFn).toBe('function');
		expect((channelNameFn as () => string)()).toBe('deployment.dep_abc');

		destroy();
	});

	it('mendaftarkan handler untuk .deployment.event.created dan .deployment.updated', () => {
		const { destroy } = runComposable();

		expect(Object.keys(capturedHandlers)).toEqual(
			expect.arrayContaining(['.deployment.event.created', '.deployment.updated'])
		);

		destroy();
	});

	it('deployment adalah data dari deploymentQuery', () => {
		const deployment = makeDeployment();
		mockCreateDeploymentQuery.mockReturnValue(
			makeDeploymentQuery({ data: { data: deployment } }) as never
		);

		const { detail, destroy } = runComposable();

		expect(detail.deployment).toEqual(deployment);

		destroy();
	});

	it('steps kosong ketika deployment belum ada', () => {
		const { detail, destroy } = runComposable();

		expect(detail.steps).toEqual([]);

		destroy();
	});

	it('isLoading true ketika salah satu query pending', () => {
		mockCreateDeploymentQuery.mockReturnValue(makeDeploymentQuery({ isPending: true }) as never);

		const { detail, destroy } = runComposable();

		expect(detail.isLoading).toBe(true);

		destroy();
	});

	it('isLoading false ketika kedua query selesai', () => {
		const { detail, destroy } = runComposable();

		expect(detail.isLoading).toBe(false);

		destroy();
	});

	describe('publicUrl', () => {
		it('menambahkan https:// ketika default_domain belum ada protokol', () => {
			mockCreateQuery.mockReturnValue({
				data: makeProject({ default_domain: 'test.run.staging.sakala.dev' })
			} as never);

			const { detail, destroy } = runComposable();

			expect(detail.publicUrl).toBe('https://test.run.staging.sakala.dev');

			destroy();
		});

		it('tidak double-protocol ketika default_domain sudah https://', () => {
			mockCreateQuery.mockReturnValue({
				data: makeProject({ default_domain: 'https://test.run.staging.sakala.dev' })
			} as never);

			const { detail, destroy } = runComposable();

			expect(detail.publicUrl).toBe('https://test.run.staging.sakala.dev');

			destroy();
		});

		it('null ketika project belum tersedia', () => {
			mockCreateQuery.mockReturnValue({ data: undefined } as never);

			const { detail, destroy } = runComposable();

			expect(detail.publicUrl).toBeNull();

			destroy();
		});

		it('null ketika default_domain kosong', () => {
			mockCreateQuery.mockReturnValue({
				data: makeProject({ default_domain: '' })
			} as never);

			const { detail, destroy } = runComposable();

			expect(detail.publicUrl).toBeNull();

			destroy();
		});
	});

	describe('bannerInput', () => {
		it('berisi status running ketika deployment belum ada', () => {
			const { detail, destroy } = runComposable();

			expect(detail.bannerInput).toEqual({ status: 'running' });

			destroy();
		});

		it('meneruskan failureCode dan failure info dari deployment', () => {
			const deployment = makeDeployment({
				status: 'failed',
				failure_code: 'runtime_build_failed',
				failure_summary: 'Build failed',
				failure: {
					code: 'runtime_build_failed',
					category: 'build',
					summary: 'Build failed at step X',
					recovery_hint: 'Periksa konfigurasi build'
				}
			});
			mockCreateDeploymentQuery.mockReturnValue(
				makeDeploymentQuery({ data: { data: deployment } }) as never
			);

			const { detail, destroy } = runComposable();

			expect(detail.bannerInput.failureCode).toBe('runtime_build_failed');
			expect(detail.bannerInput.failureSummary).toBe('Build failed at step X');
			expect(detail.bannerInput.recoveryHint).toBe('Periksa konfigurasi build');
			expect(detail.bannerInput.status).toBe('failed');

			destroy();
		});

		it('fallback ke failure_summary ketika failure object null', () => {
			const deployment = makeDeployment({
				status: 'failed',
				failure_code: 'X',
				failure_summary: 'Fallback summary',
				failure: null
			});
			mockCreateDeploymentQuery.mockReturnValue(
				makeDeploymentQuery({ data: { data: deployment } }) as never
			);

			const { detail, destroy } = runComposable();

			expect(detail.bannerInput.failureSummary).toBe('Fallback summary');

			destroy();
		});
	});

	describe('error getters', () => {
		it('deploymentError null ketika query tidak error', () => {
			const { detail, destroy } = runComposable();

			expect(detail.deploymentError).toBeNull();

			destroy();
		});

		it('deploymentError berisi config ketika query error', () => {
			const error = new ApiError('Server error', 500);
			mockCreateDeploymentQuery.mockReturnValue(
				makeDeploymentQuery({ isError: true, error }) as never
			);

			const { detail, destroy } = runComposable();

			expect(detail.deploymentError).not.toBeNull();
			expect(detail.deploymentError?.title).toBe('Server sedang bermasalah');

			destroy();
		});

		it('deploymentError berisi config NetworkError ketika error adalah NetworkError', () => {
			const error = new NetworkError();
			mockCreateDeploymentQuery.mockReturnValue(
				makeDeploymentQuery({ isError: true, error }) as never
			);

			const { detail, destroy } = runComposable();

			expect(detail.deploymentError).not.toBeNull();
			expect(detail.deploymentError?.title).toBe('Koneksi terputus');
			expect(detail.deploymentError?.showRetry).toBe(true);

			destroy();
		});

		it('deploymentError menampilkan 404 config untuk ApiError 404', () => {
			const error = new ApiError('Not found', 404);
			mockCreateDeploymentQuery.mockReturnValue(
				makeDeploymentQuery({ isError: true, error }) as never
			);

			const { detail, destroy } = runComposable();

			expect(detail.deploymentError?.title).toBe('Deployment tidak ditemukan');
			expect(detail.deploymentError?.showRetry).toBe(false);

			destroy();
		});

		it('eventsError null ketika events query tidak error', () => {
			const { detail, destroy } = runComposable();

			expect(detail.eventsError).toBeNull();

			destroy();
		});
	});

	describe('realtime handlers', () => {
		it('.deployment.updated → refetch deploymentQuery', () => {
			const refetch = vi.fn();
			mockCreateDeploymentQuery.mockReturnValue(makeDeploymentQuery({ refetch }) as never);

			const { destroy } = runComposable();

			capturedHandlers['.deployment.updated']?.({ sequence: 5 });

			expect(mockGuardAccept).toHaveBeenCalledWith(5);
			expect(refetch).toHaveBeenCalledTimes(1);

			destroy();
		});

		it('.deployment.event.created → refetch deploymentEventsQuery', () => {
			const refetch = vi.fn();
			mockCreateDeploymentEventsQuery.mockReturnValue(makeDeploymentQuery({ refetch }) as never);

			const { destroy } = runComposable();

			capturedHandlers['.deployment.event.created']?.({ sequence: 5 });

			expect(mockGuardAccept).toHaveBeenCalledWith(5);
			expect(refetch).toHaveBeenCalledTimes(1);

			destroy();
		});

		it('tidak refetch ketika sequence bukan number', () => {
			const refetch = vi.fn();
			mockCreateDeploymentQuery.mockReturnValue(makeDeploymentQuery({ refetch }) as never);

			const { destroy } = runComposable();

			capturedHandlers['.deployment.updated']?.({ sequence: '5' } as unknown);
			capturedHandlers['.deployment.updated']?.({} as unknown);

			expect(mockGuardAccept).not.toHaveBeenCalled();
			expect(refetch).not.toHaveBeenCalled();

			destroy();
		});

		it('tidak refetch ketika guard.accept menolak sequence', () => {
			mockGuardAccept.mockReturnValue(false);
			const refetch = vi.fn();
			mockCreateDeploymentQuery.mockReturnValue(makeDeploymentQuery({ refetch }) as never);

			const { destroy } = runComposable();

			capturedHandlers['.deployment.updated']?.({ sequence: 5 });

			expect(mockGuardAccept).toHaveBeenCalledWith(5);
			expect(refetch).not.toHaveBeenCalled();

			destroy();
		});
	});

	describe('infoTimestamp', () => {
		it('"-" ketika deployment belum ada', () => {
			const { detail, destroy } = runComposable();
			expect(detail.infoTimestamp).toBe('-');
			destroy();
		});

		it('memakai started_at ketika running', () => {
			mockCreateDeploymentQuery.mockReturnValue(
				makeDeploymentQuery({
					data: {
						data: makeDeployment({
							status: 'running',
							started_at: '2026-09-20T08:41:02Z',
							finished_at: null
						})
					}
				}) as never
			);
			const { detail, destroy } = runComposable();
			expect(detail.infoTimestamp).toMatch(/^\d{2}[:.]\d{2}[:.]\d{2}$/);
			destroy();
		});

		it('memakai finished_at ketika succeeded', () => {
			mockCreateDeploymentQuery.mockReturnValue(
				makeDeploymentQuery({
					data: {
						data: makeDeployment({ status: 'succeeded', finished_at: '2026-09-20T08:41:49Z' })
					}
				}) as never
			);
			const { detail, destroy } = runComposable();
			expect(detail.infoTimestamp).toMatch(/^\d{2}[:.]\d{2}[:.]\d{2}$/);
			destroy();
		});

		it('memakai finished_at ketika failed', () => {
			mockCreateDeploymentQuery.mockReturnValue(
				makeDeploymentQuery({
					data: { data: makeDeployment({ status: 'failed', finished_at: '2026-09-20T08:39:12Z' }) }
				}) as never
			);
			const { detail, destroy } = runComposable();
			expect(detail.infoTimestamp).toMatch(/^\d{2}[:.]\d{2}[:.]\d{2}$/);
			destroy();
		});
	});

	describe('lastUpdateTimestamp', () => {
		it('"-" ketika events kosong', () => {
			const { detail, destroy } = runComposable();

			expect(detail.lastUpdateTimestamp).toBe('-');

			destroy();
		});

		it('memakai occurred_at event terakhir', () => {
			const deployment = makeDeployment();

			mockCreateDeploymentQuery.mockReturnValue(
				makeDeploymentQuery({ data: { data: deployment } }) as never
			);

			mockCreateDeploymentEventsQuery.mockReturnValue(
				makeDeploymentQuery({
					data: {
						data: [
							{
								sequence: 1,
								level: 'info',
								type: null,
								message: 'a',
								metadata: null,
								occurred_at: '2026-09-20T10:00:00Z'
							},
							{
								sequence: 2,
								level: 'info',
								type: null,
								message: 'b',
								metadata: null,
								occurred_at: '2026-09-20T10:05:00Z'
							}
						]
					}
				}) as never
			);

			const { detail, destroy } = runComposable();

			expect(detail.lastUpdateTimestamp).not.toBe('-');
			expect(detail.lastUpdateTimestamp).toMatch(/^\d{2}[:.]\d{2}[:.]\d{2}$/);

			destroy();
		});
	});
});

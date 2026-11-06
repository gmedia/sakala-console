import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { flushSync } from 'svelte';
import { useDeploymentDetail } from './use-deployment-detail.svelte';
import { usePrivateChannel } from '$lib/features/realtime/use-channel.svelte';
import {
	applyRealtimeDeploymentEvent,
	applyRealtimeDeploymentUpdate,
	createDeploymentQuery,
	createDeploymentEventsQuery
} from './queries';
import { createProjectQuery, requestProjectRefresh } from '$lib/features/projects/queries';
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

vi.mock('@tanstack/svelte-query', () => ({
	useQueryClient: () => ({})
}));

vi.mock('./queries', () => ({
	createDeploymentQuery: vi.fn(),
	createDeploymentEventsQuery: vi.fn(),
	applyRealtimeDeploymentEvent: vi.fn(() => false),
	applyRealtimeDeploymentUpdate: vi.fn(() => false)
}));

vi.mock('$lib/features/projects/queries', () => ({
	createProjectQuery: vi.fn(),
	requestProjectRefresh: vi.fn()
}));

const mockUsePrivateChannel = vi.mocked(usePrivateChannel);
const mockCreateDeploymentQuery = vi.mocked(createDeploymentQuery);
const mockCreateDeploymentEventsQuery = vi.mocked(createDeploymentEventsQuery);
const mockCreateProjectQuery = vi.mocked(createProjectQuery);

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
		is_active: true,
		cancel_requested_at: null,
		queue_state: null,
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
		status: 'active',
		runtime_status: 'running',
		active_deployment_id: 'dep_1',
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
	mockCreateProjectQuery.mockReturnValue({ data: undefined } as never);
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
		it('memakai public_url dari API, termasuk scheme dan port-nya', () => {
			mockCreateProjectQuery.mockReturnValue({
				data: makeProject({ public_url: 'http://test.apps.localhost:8080' })
			} as never);

			const { detail, destroy } = runComposable();

			expect(detail.publicUrl).toBe('http://test.apps.localhost:8080');

			destroy();
		});

		it('null ketika project belum tersedia', () => {
			mockCreateProjectQuery.mockReturnValue({ data: undefined } as never);

			const { detail, destroy } = runComposable();

			expect(detail.publicUrl).toBeNull();

			destroy();
		});

		it('null ketika API tidak mengirim public_url, walaupun ada default_domain', () => {
			mockCreateProjectQuery.mockReturnValue({
				data: makeProject({ public_url: null, default_domain: 'test.run.staging.sakala.dev' })
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
		it('.deployment.updated yang sudah masuk cache tidak butuh request', () => {
			vi.useFakeTimers();
			vi.mocked(applyRealtimeDeploymentUpdate).mockReturnValueOnce(true);
			const refetch = vi.fn();
			mockCreateDeploymentQuery.mockReturnValue(makeDeploymentQuery({ refetch }) as never);

			const { destroy } = runComposable();

			capturedHandlers['.deployment.updated']?.({ sequence: 5, status: 'building' });
			vi.advanceTimersByTime(5_000);

			expect(mockGuardAccept).toHaveBeenCalledWith(5);
			expect(refetch).not.toHaveBeenCalled();

			destroy();
			vi.useRealTimers();
		});

		it('banyak .deployment.updated yang butuh baca ulang hanya memicu satu request', () => {
			vi.useFakeTimers();
			const refetch = vi.fn();
			mockCreateDeploymentQuery.mockReturnValue(makeDeploymentQuery({ refetch }) as never);

			const { destroy } = runComposable();

			capturedHandlers['.deployment.updated']?.({ sequence: 5 });
			capturedHandlers['.deployment.updated']?.({ sequence: 6 });
			capturedHandlers['.deployment.updated']?.({ sequence: 7 });
			vi.advanceTimersByTime(1_000);

			expect(refetch).toHaveBeenCalledTimes(1);
			expect(refetch).toHaveBeenCalledWith({ cancelRefetch: false });

			destroy();
			vi.useRealTimers();
		});

		it('.deployment.event.created yang sudah masuk cache tidak butuh request', () => {
			vi.useFakeTimers();
			vi.mocked(applyRealtimeDeploymentEvent).mockReturnValueOnce(true);
			const refetch = vi.fn();
			mockCreateDeploymentEventsQuery.mockReturnValue(makeDeploymentQuery({ refetch }) as never);

			const { destroy } = runComposable();

			capturedHandlers['.deployment.event.created']?.({ sequence: 5 });
			vi.advanceTimersByTime(5_000);

			expect(refetch).not.toHaveBeenCalled();

			destroy();
			vi.useRealTimers();
		});

		it('.deployment.event.created sebelum daftar termuat membaca ulang sekali', () => {
			vi.useFakeTimers();
			const refetch = vi.fn();
			mockCreateDeploymentEventsQuery.mockReturnValue(makeDeploymentQuery({ refetch }) as never);

			const { destroy } = runComposable();

			capturedHandlers['.deployment.event.created']?.({ sequence: 5 });
			capturedHandlers['.deployment.event.created']?.({ sequence: 6 });
			vi.advanceTimersByTime(1_000);

			expect(refetch).toHaveBeenCalledTimes(1);

			destroy();
			vi.useRealTimers();
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
			expect(detail.infoTimestamp).toMatch(/^(\d{1,2} \w{3} \d{4} )?\d{2}:\d{2}:\d{2}$/);
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
			expect(detail.infoTimestamp).toMatch(/^(\d{1,2} \w{3} \d{4} )?\d{2}:\d{2}:\d{2}$/);
			destroy();
		});

		it('memakai finished_at ketika failed', () => {
			mockCreateDeploymentQuery.mockReturnValue(
				makeDeploymentQuery({
					data: { data: makeDeployment({ status: 'failed', finished_at: '2026-09-20T08:39:12Z' }) }
				}) as never
			);
			const { detail, destroy } = runComposable();
			expect(detail.infoTimestamp).toMatch(/^(\d{1,2} \w{3} \d{4} )?\d{2}:\d{2}:\d{2}$/);
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
			expect(detail.lastUpdateTimestamp).toMatch(/^(\d{1,2} \w{3} \d{4} )?\d{2}:\d{2}:\d{2}$/);

			destroy();
		});
	});
});

describe('useDeploymentDetail - new contract fields', () => {
	function bannerFor(deployment: object, project: object = makeProject()) {
		mockCreateDeploymentQuery.mockReturnValue(
			makeDeploymentQuery({ data: { data: makeDeployment(deployment) } }) as never
		);
		mockCreateProjectQuery.mockReturnValue({ data: project, refetch: vi.fn() } as never);
		const { detail, destroy } = runComposable();
		const input = detail.bannerInput;
		destroy();
		return input;
	}

	const failure = {
		code: 'runtime_health_check_failed',
		category: 'health',
		summary: 'Aplikasi tidak menjawab.',
		recovery_hint: 'Pastikan aplikasi membaca PORT.',
		user_fixable: false,
		detail: 'connection refused',
		stage: 'health_checking'
	};

	it('reads the failed stage from failure.stage, with no events at all (U-21)', () => {
		const input = bannerFor({ status: 'failed', failure });

		expect(input.failedStepLabel).toBe('Mengecek aplikasi');
		expect(input.failureDetail).toBe('connection refused');
		expect(input.userFixable).toBe(false);
	});

	it('marks a cancelled deployment as cancelled', () => {
		expect(bannerFor({ status: 'cancelled' }).status).toBe('cancelled');
	});

	it.each([
		['the active deployment on a serving project', { is_active: true }, {}, 'live'],
		['a superseded deployment', { is_active: false }, {}, 'superseded'],
		[
			'the active deployment of a stopped project',
			{},
			{ runtime_status: 'stopped' },
			'not_serving'
		],
		[
			'the active deployment of a crashed project',
			{},
			{ runtime_status: 'crashed' },
			'crash_looping'
		],
		['the active deployment of a suspended project', {}, { status: 'suspended' }, 'not_serving']
	])('%s reads as %s (U-20)', (_name, deployment, project, expected) => {
		expect(
			bannerFor({ status: 'succeeded', ...deployment }, makeProject(project)).servingState
		).toBe(expected);
	});

	it('waits for the read before calling the newest deployment superseded', () => {
		const query = $state({
			...makeDeploymentQuery(),
			data: {
				servingUnconfirmed: true,
				data: makeDeployment({ status: 'succeeded', is_active: false })
			}
		});
		mockCreateDeploymentQuery.mockReturnValue(query as never);
		mockCreateProjectQuery.mockReturnValue({ data: makeProject(), refetch: vi.fn() } as never);

		const { detail, destroy } = runComposable();
		expect(detail.bannerInput.servingState).toBe('unconfirmed');

		// What the read returns replaces the patched copy: this one did become the active deployment.
		query.data = { data: makeDeployment({ status: 'succeeded', is_active: true }) } as never;
		flushSync();
		expect(detail.bannerInput.servingState).toBe('live');

		destroy();
	});

	it('still reports superseded once the read confirms is_active is false', () => {
		mockCreateDeploymentQuery.mockReturnValue(
			makeDeploymentQuery({
				data: { data: makeDeployment({ status: 'succeeded', is_active: false }) }
			}) as never
		);
		mockCreateProjectQuery.mockReturnValue({ data: makeProject(), refetch: vi.fn() } as never);

		const { detail, destroy } = runComposable();
		expect(detail.bannerInput.servingState).toBe('superseded');

		destroy();
	});

	it('passes the queue state and a requested cancel on (U-22, U-51)', () => {
		const input = bannerFor({
			status: 'queued',
			queue_state: 'waiting_for_node',
			cancel_requested_at: '2026-09-20T10:00:00Z'
		});

		expect(input.queueState).toBe('waiting_for_node');
		expect(input.cancelRequested).toBe(true);
	});

	it('dates a cancelled deployment from cancelled_at', () => {
		mockCreateDeploymentQuery.mockReturnValue(
			makeDeploymentQuery({
				data: {
					data: makeDeployment({
						status: 'cancelled',
						finished_at: null,
						cancelled_at: '2026-09-20T10:05:00Z'
					})
				}
			}) as never
		);
		mockCreateProjectQuery.mockReturnValue({ data: makeProject(), refetch: vi.fn() } as never);

		const { detail, destroy } = runComposable();

		expect(detail.infoTimestamp).not.toBe('-');
		destroy();
	});

	it('re-reads the project when the deployment finishes', () => {
		vi.mocked(requestProjectRefresh).mockClear();
		const refetch = vi.fn();
		const query = $state({
			...makeDeploymentQuery(),
			data: { data: makeDeployment({ status: 'building' }) }
		});
		mockCreateDeploymentQuery.mockReturnValue(query as never);
		mockCreateProjectQuery.mockReturnValue({ data: makeProject(), refetch } as never);

		const { destroy } = runComposable();
		flushSync();
		expect(requestProjectRefresh).not.toHaveBeenCalled();

		query.data = { data: makeDeployment({ status: 'succeeded' }) };
		flushSync();

		expect(requestProjectRefresh).toHaveBeenCalledTimes(1);
		destroy();
	});
});

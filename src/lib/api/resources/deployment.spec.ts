import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../client';
import {
	cancelDeployment,
	getDeployment,
	getDeploymentEvents,
	getAllDeploymentEvents,
	getDeploymentLogs,
	parseDeploymentLogsResponse,
	parseDeploymentResponse,
	parseDeploymentEventsResponse,
	DeploymentEventsTruncationError,
	type Deployment,
	type DeploymentEvent,
	type DeploymentEventsResponse
} from './deployment';

vi.mock('../client', () => ({
	apiRequest: vi.fn()
}));

const mockApiRequest = vi.mocked(apiRequest);

const validDeployment: Deployment = {
	id: 'dep_1',
	project_id: 'proj_1',
	sequence: 1,
	branch: 'main',
	status: 'success',
	trigger: 'push',
	commit_sha: 'abc123',
	commit_message: 'feat: add something',
	image_reference: 'registry.example.com/app:abc123',
	requested_resources: {
		memory_mb: 512,
		cpu_millis: 1000,
		pids_limit: 128
	},
	effective_resources: {
		resources: {
			memory_mb: 512,
			cpu_millis: 1000,
			pids_limit: 128
		},
		timeouts: {
			build_timeout_seconds: 600,
			start_timeout_seconds: 120,
			command_timeout_seconds: 900
		},
		log_bounds: {
			max_line_length: 4096,
			max_batch_lines: 500,
			max_total_bytes: 10485760
		}
	},
	applied_resources: {
		memory_mb: 512,
		cpu_millis: 1000,
		pids_limit: 128
	},
	finalization_deferred: false,
	finalization_deferred_reason: null,
	is_active: true,
	cancel_requested_at: null,
	queue_state: null,
	agent_node_id: null,
	started_at: '2024-01-01T00:00:00Z',
	finished_at: '2024-01-01T00:01:00Z',
	cancelled_at: null,
	failure_code: null,
	failure_summary: null,
	failure: null,
	created_at: '2024-01-01T00:00:00Z',
	updated_at: '2024-01-01T00:01:00Z'
};

const validDeploymentResponse = {
	data: validDeployment
};

const validDeploymentEvent: DeploymentEvent = {
	sequence: 1,
	level: 'info',
	type: 'build',
	message: 'Building image',
	metadata: { builder: 'docker', domain: 'example.com' },
	occurred_at: '2024-01-01T00:00:00Z'
};

const validDeploymentEventsResponse: DeploymentEventsResponse = {
	data: [validDeploymentEvent],
	links: {
		first: null,
		last: null,
		prev: null,
		next: null
	},
	meta: {
		path: null,
		per_page: 20,
		next_cursor: null,
		prev_cursor: null
	}
};

function makeEventPage(
	events: DeploymentEvent[],
	nextCursor: string | null
): DeploymentEventsResponse {
	return {
		data: events,
		links: { first: null, last: null, prev: null, next: null },
		meta: {
			path: null,
			per_page: 6,
			next_cursor: nextCursor,
			prev_cursor: null
		}
	};
}

describe('parseDeploymentResponse', () => {
	it('mengembalikan response deployment yang valid', () => {
		const result = parseDeploymentResponse(validDeploymentResponse);
		expect(result).toEqual(validDeploymentResponse);
	});

	it('menerima semua resource sebagai null', () => {
		const result = parseDeploymentResponse({
			data: {
				...validDeployment,
				requested_resources: null,
				effective_resources: null,
				applied_resources: null
			}
		});
		expect(result.data.requested_resources).toBeNull();
		expect(result.data.effective_resources).toBeNull();
		expect(result.data.applied_resources).toBeNull();
	});

	it('menerima requested_resources dengan field nullable', () => {
		const result = parseDeploymentResponse({
			data: {
				...validDeployment,
				requested_resources: {
					memory_mb: null,
					cpu_millis: 500,
					pids_limit: null
				}
			}
		});
		expect(result.data.requested_resources).toEqual({
			memory_mb: null,
			cpu_millis: 500,
			pids_limit: null
		});
	});

	it('menerima applied_resources sebagai object', () => {
		const result = parseDeploymentResponse({
			data: {
				...validDeployment,
				applied_resources: { memory_mb: 256, cpu_millis: 500, pids_limit: 64 }
			}
		});
		expect(result.data.applied_resources).toEqual({
			memory_mb: 256,
			cpu_millis: 500,
			pids_limit: 64
		});
	});

	it('menerima applied_resources null', () => {
		const result = parseDeploymentResponse({
			data: { ...validDeployment, applied_resources: null }
		});
		expect(result.data.applied_resources).toBeNull();
	});

	it('membaca applied_resources berbentuk array sebagai kosong', () => {
		const result = parseDeploymentResponse({
			data: {
				...validDeployment,
				applied_resources: [{ memory_mb: 256 }]
			}
		});

		expect(result.data.applied_resources).toBeNull();
	});

	it('membaca applied_resources yang tidak lengkap sebagai kosong', () => {
		const result = parseDeploymentResponse({
			data: {
				...validDeployment,
				applied_resources: { memory_mb: 256, cpu_millis: 500 }
			}
		});

		expect(result.data.applied_resources).toBeNull();
	});

	it('melempar error jika response deployment tidak valid', () => {
		expect(() => parseDeploymentResponse({ data: {} })).toThrow();
	});

	it('membaca requested_resources yang salah tipe sebagai kosong', () => {
		const result = parseDeploymentResponse({
			data: {
				...validDeployment,
				requested_resources: {
					memory_mb: 'bukan-angka',
					cpu_millis: 500,
					pids_limit: 128
				}
			}
		});

		expect(result.data.requested_resources).toBeNull();
	});

	it('membaca effective_resources yang tidak lengkap sebagai kosong', () => {
		const result = parseDeploymentResponse({
			data: {
				...validDeployment,
				effective_resources: {
					resources: { memory_mb: 256 },
					timeouts: {
						build_timeout_seconds: 600,
						start_timeout_seconds: 120,
						command_timeout_seconds: 900
					},
					log_bounds: {
						max_line_length: 4096,
						max_batch_lines: 500,
						max_total_bytes: 10485760
					}
				}
			}
		});

		expect(result.data.effective_resources).toBeNull();
	});

	it('menerima finalization_deferred_reason grace_elapsed', () => {
		const result = parseDeploymentResponse({
			data: {
				...validDeployment,
				finalization_deferred: true,
				finalization_deferred_reason: 'grace_elapsed'
			}
		});
		expect(result.data.finalization_deferred_reason).toBe('grace_elapsed');
	});

	it('menerima finalization_deferred_reason runtime_error', () => {
		const result = parseDeploymentResponse({
			data: {
				...validDeployment,
				finalization_deferred: true,
				finalization_deferred_reason: 'runtime_error'
			}
		});
		expect(result.data.finalization_deferred_reason).toBe('runtime_error');
	});

	it('menerima finalization_deferred_reason null', () => {
		const result = parseDeploymentResponse({
			data: {
				...validDeployment,
				finalization_deferred_reason: null
			}
		});
		expect(result.data.finalization_deferred_reason).toBeNull();
	});

	it('membaca finalization_deferred_reason yang tidak dikenal sebagai kosong', () => {
		const result = parseDeploymentResponse({
			data: {
				...validDeployment,
				finalization_deferred_reason: 'unknown_value'
			}
		});

		expect(result.data.finalization_deferred_reason).toBeNull();
	});
});

describe('parseDeploymentEventsResponse', () => {
	it('mengembalikan response deployment events yang valid', () => {
		const result = parseDeploymentEventsResponse(validDeploymentEventsResponse);
		expect(result).toEqual(validDeploymentEventsResponse);
	});

	it('melewati event dengan level yang tidak dikenal', () => {
		const result = parseDeploymentEventsResponse({
			...validDeploymentEventsResponse,
			data: [
				{
					...validDeploymentEvent,
					level: 'debug'
				}
			]
		});

		expect(result.data).toEqual([]);
	});

	it('menerima events dengan metadata null dan type null', () => {
		const result = parseDeploymentEventsResponse({
			...validDeploymentEventsResponse,
			data: [
				{
					...validDeploymentEvent,
					type: null,
					metadata: null
				}
			]
		});
		expect(result.data[0].type).toBeNull();
		expect(result.data[0].metadata).toBeNull();
	});

	it('menerima metadata event sebagai object', () => {
		const result = parseDeploymentEventsResponse({
			...validDeploymentEventsResponse,
			data: [
				{
					...validDeploymentEvent,
					metadata: { builder: 'nixpacks', domain: 'app.staging.sakala.dev' }
				}
			]
		});
		expect(result.data[0].metadata).toEqual({
			builder: 'nixpacks',
			domain: 'app.staging.sakala.dev'
		});
	});

	it('menerima metadata event dengan key apapun', () => {
		const result = parseDeploymentEventsResponse({
			...validDeploymentEventsResponse,
			data: [
				{
					...validDeploymentEvent,
					metadata: { component: 'build', image: 'sha256:abc123', resources: { cpu: 500 } }
				}
			]
		});
		expect(result.data[0].metadata).toEqual({
			component: 'build',
			image: 'sha256:abc123',
			resources: { cpu: 500 }
		});
	});

	it('menerima metadata event sebagai empty object', () => {
		const result = parseDeploymentEventsResponse({
			...validDeploymentEventsResponse,
			data: [
				{
					...validDeploymentEvent,
					metadata: {}
				}
			]
		});
		expect(result.data[0].metadata).toEqual({});
	});

	it('membaca metadata berbentuk array sebagai kosong, tanpa menjatuhkan timeline', () => {
		const result = parseDeploymentEventsResponse({
			...validDeploymentEventsResponse,
			data: [
				{
					...validDeploymentEvent,
					metadata: [{ step: 'build' }]
				}
			]
		});

		expect(result.data[0].metadata).toBeNull();
	});
});

describe('getDeployment', () => {
	beforeEach(() => {
		mockApiRequest.mockReset();
	});

	it('memanggil apiRequest dengan URL yang benar dan mengembalikan deployment', async () => {
		mockApiRequest.mockResolvedValueOnce(validDeploymentResponse);

		const result = await getDeployment('proj_1', 'dep_1');

		expect(mockApiRequest).toHaveBeenCalledTimes(1);
		expect(mockApiRequest).toHaveBeenCalledWith('api/v1/app/projects/proj_1/deployments/dep_1');
		expect(result).toEqual(validDeploymentResponse);
	});

	it('melempar error jika response dari API tidak valid', async () => {
		mockApiRequest.mockResolvedValueOnce({ data: {} });

		await expect(getDeployment('proj_1', 'dep_1')).rejects.toThrow();
	});

	it('meneruskan error dari apiRequest', async () => {
		mockApiRequest.mockRejectedValueOnce(new Error('Network error'));

		await expect(getDeployment('proj_1', 'dep_1')).rejects.toThrow('Network error');
	});
});

describe('getDeploymentEvents', () => {
	beforeEach(() => {
		mockApiRequest.mockReset();
	});

	it('memanggil apiRequest dengan params dan mengembalikan events', async () => {
		mockApiRequest.mockResolvedValueOnce(validDeploymentEventsResponse);

		const params = {
			cursor: 'cursor_1',
			per_page: 10
		};

		const result = await getDeploymentEvents('proj_1', 'dep_1', params);

		expect(mockApiRequest).toHaveBeenCalledTimes(1);
		expect(mockApiRequest).toHaveBeenCalledWith(
			'api/v1/app/projects/proj_1/deployments/dep_1/events',
			{ params }
		);
		expect(result).toEqual(validDeploymentEventsResponse);
	});

	it('tetap memanggil apiRequest tanpa params', async () => {
		mockApiRequest.mockResolvedValueOnce(validDeploymentEventsResponse);

		await getDeploymentEvents('proj_1', 'dep_1');

		expect(mockApiRequest).toHaveBeenCalledWith(
			'api/v1/app/projects/proj_1/deployments/dep_1/events',
			{ params: undefined }
		);
	});

	it('melempar error jika response events tidak valid', async () => {
		mockApiRequest.mockResolvedValueOnce({ data: [] });

		await expect(getDeploymentEvents('proj_1', 'dep_1')).rejects.toThrow();
	});
});

describe('getAllDeploymentEvents', () => {
	beforeEach(() => {
		mockApiRequest.mockReset();
	});

	function makeEventPage(
		events: DeploymentEvent[],
		nextCursor: string | null
	): DeploymentEventsResponse {
		return {
			data: events,
			links: { first: null, last: null, prev: null, next: null },
			meta: {
				path: null,
				per_page: 6,
				next_cursor: nextCursor,
				prev_cursor: null
			}
		};
	}

	it('mengembalikan events dari single page tanpa loop tambahan', async () => {
		mockApiRequest.mockResolvedValueOnce(makeEventPage([validDeploymentEvent], null));

		const result = await getAllDeploymentEvents('proj_1', 'dep_1');

		expect(mockApiRequest).toHaveBeenCalledTimes(1);
		expect(mockApiRequest).toHaveBeenCalledWith(
			'api/v1/app/projects/proj_1/deployments/dep_1/events',
			{ params: { cursor: undefined, per_page: 10 } }
		);
		expect(result.data).toEqual([validDeploymentEvent]);
		expect(result.meta.next_cursor).toBeNull();
	});

	it('loop sampai next_cursor null dan merge semua page', async () => {
		const e1: DeploymentEvent = { ...validDeploymentEvent, sequence: 1 };
		const e2: DeploymentEvent = { ...validDeploymentEvent, sequence: 2 };
		const e3: DeploymentEvent = { ...validDeploymentEvent, sequence: 3 };

		mockApiRequest.mockResolvedValueOnce(makeEventPage([e1, e2], 'cursor_a'));

		mockApiRequest.mockResolvedValueOnce(makeEventPage([e3], 'cursor_b'));

		mockApiRequest.mockResolvedValueOnce(makeEventPage([], null));

		const result = await getAllDeploymentEvents('proj_1', 'dep_1');

		expect(mockApiRequest).toHaveBeenCalledTimes(3);
		expect(result.data).toEqual([e1, e2, e3]);
		expect(result.meta.next_cursor).toBeNull();
	});

	it('mengirim cursor dari page sebelumnya pada request berikutnya', async () => {
		mockApiRequest.mockResolvedValueOnce(makeEventPage([validDeploymentEvent], 'cursor_next'));
		mockApiRequest.mockResolvedValueOnce(makeEventPage([], null));

		await getAllDeploymentEvents('proj_1', 'dep_1');

		expect(mockApiRequest).toHaveBeenNthCalledWith(
			1,
			'api/v1/app/projects/proj_1/deployments/dep_1/events',
			{ params: { cursor: undefined, per_page: 10 } }
		);

		expect(mockApiRequest).toHaveBeenNthCalledWith(
			2,
			'api/v1/app/projects/proj_1/deployments/dep_1/events',
			{ params: { cursor: 'cursor_next', per_page: 10 } }
		);
	});

	it('mempertahankan urutan sequence ascending setelah merge', async () => {
		const e1: DeploymentEvent = { ...validDeploymentEvent, sequence: 1 };
		const e2: DeploymentEvent = { ...validDeploymentEvent, sequence: 2 };
		const e3: DeploymentEvent = { ...validDeploymentEvent, sequence: 3 };

		mockApiRequest.mockResolvedValueOnce(makeEventPage([e1, e2], 'c1'));
		mockApiRequest.mockResolvedValueOnce(makeEventPage([e3], null));

		const result = await getAllDeploymentEvents('proj_1', 'dep_1');

		expect(result.data.map((e) => e.sequence)).toEqual([1, 2, 3]);
	});

	it('merge events dari banyak page tanpa duplikasi', async () => {
		const e1: DeploymentEvent = { ...validDeploymentEvent, sequence: 1 };
		const e2: DeploymentEvent = { ...validDeploymentEvent, sequence: 2 };
		const e3: DeploymentEvent = { ...validDeploymentEvent, sequence: 3 };
		const e4: DeploymentEvent = { ...validDeploymentEvent, sequence: 4 };

		mockApiRequest.mockResolvedValueOnce(makeEventPage([e1, e2], 'c1'));
		mockApiRequest.mockResolvedValueOnce(makeEventPage([e3, e4], 'c2'));
		mockApiRequest.mockResolvedValueOnce(makeEventPage([], null));

		const result = await getAllDeploymentEvents('proj_1', 'dep_1');

		expect(result.data).toHaveLength(4);
		expect(result.data.map((e) => e.sequence)).toEqual([1, 2, 3, 4]);
	});

	it('meneruskan error dari apiRequest di halaman manapun', async () => {
		mockApiRequest.mockResolvedValueOnce(makeEventPage([validDeploymentEvent], 'cursor_a'));
		mockApiRequest.mockRejectedValueOnce(new Error('Network error'));

		await expect(getAllDeploymentEvents('proj_1', 'dep_1')).rejects.toThrow('Network error');
	});

	it('throw TruncationError ketika cap tercapai tapi next_cursor masih ada', async () => {
		for (let i = 0; i < 50; i++) {
			mockApiRequest.mockResolvedValueOnce(makeEventPage([validDeploymentEvent], `cursor_${i}`));
		}

		await expect(getAllDeploymentEvents('proj_1', 'dep_1')).rejects.toThrow(
			DeploymentEventsTruncationError
		);

		expect(mockApiRequest).toHaveBeenCalledTimes(50);
	});

	it('tidak throw kalau halaman ke-50 punya next_cursor null (data lengkap)', async () => {
		for (let i = 0; i < 49; i++) {
			mockApiRequest.mockResolvedValueOnce(makeEventPage([validDeploymentEvent], `cursor_${i}`));
		}
		mockApiRequest.mockResolvedValueOnce(makeEventPage([validDeploymentEvent], null));

		const result = await getAllDeploymentEvents('proj_1', 'dep_1');

		expect(result.data).toHaveLength(50);
		expect(result.meta.next_cursor).toBeNull();
	});
});

describe('DeploymentEventsTruncationError', () => {
	it('isRetryable = false', () => {
		const error = new DeploymentEventsTruncationError('dep_1', 50, 300, 'cursor_x');
		expect(error.isRetryable).toBe(false);
	});

	it('punya info diagnostik lengkap', () => {
		const error = new DeploymentEventsTruncationError('dep_abc', 50, 300, 'cursor_xyz');

		expect(error.deploymentId).toBe('dep_abc');
		expect(error.pagesFetched).toBe(50);
		expect(error.eventsFetched).toBe(300);
		expect(error.remainingCursor).toBe('cursor_xyz');
	});

	it('name-nya DeploymentEventsTruncationError', () => {
		const error = new DeploymentEventsTruncationError('dep_1', 50, 300, 'cursor_x');
		expect(error.name).toBe('DeploymentEventsTruncationError');
	});

	it('message mengandung info yang berguna untuk debugging', () => {
		const error = new DeploymentEventsTruncationError('dep_abc', 50, 300, 'cursor_xyz');

		expect(error.message).toContain('Truncated at 50 pages');
		expect(error.message).toContain('300 events');
		expect(error.message).toContain('dep_abc');
		expect(error.message).toContain('cursor_xyz');
	});

	it('instanceof Error — supaya bisa di-catch oleh error handler generik', () => {
		const error = new DeploymentEventsTruncationError('dep_1', 50, 300, 'cursor_x');
		expect(error).toBeInstanceOf(Error);
	});

	it('error dari getAllDeploymentEvents membawa info diagnostik lengkap', async () => {
		mockApiRequest.mockReset();

		for (let i = 0; i < 50; i++) {
			mockApiRequest.mockResolvedValueOnce(makeEventPage([validDeploymentEvent], `cursor_${i}`));
		}

		try {
			await getAllDeploymentEvents('proj_1', 'dep_x');
			expect.fail('should have thrown');
		} catch (error) {
			expect(error).toBeInstanceOf(DeploymentEventsTruncationError);
			const e = error as DeploymentEventsTruncationError;
			expect(e.deploymentId).toBe('dep_x');
			expect(e.pagesFetched).toBe(50);
			expect(e.eventsFetched).toBe(50);
			expect(e.remainingCursor).toBe('cursor_49');
			expect(e.isRetryable).toBe(false);
		}
	});
});

describe('deployment logs resource', () => {
	const validResponse = {
		data: [
			{
				sequence: 1,
				stream: 'stderr',
				message: 'npm warn deprecated',
				recorded_at: '2026-09-20T08:41:02.000000Z'
			}
		],
		links: { first: null, last: null, prev: null, next: null },
		meta: { path: null, per_page: 10, next_cursor: 'abc', prev_cursor: null }
	};

	it('requests the logs path with the cursor and page size', async () => {
		mockApiRequest.mockResolvedValueOnce(validResponse);

		const result = await getDeploymentLogs('proj_1', 'dep_1', { cursor: 'abc', per_page: 10 });

		expect(mockApiRequest).toHaveBeenCalledWith(
			'api/v1/app/projects/proj_1/deployments/dep_1/logs',
			{ params: { cursor: 'abc', per_page: 10 } }
		);
		expect(result.meta.next_cursor).toBe('abc');
	});

	it('skips a line with a stream value outside the contract', () => {
		const result = parseDeploymentLogsResponse({
			...validResponse,
			data: [{ ...validResponse.data[0], stream: 'build' }]
		});

		expect(result.data).toEqual([]);
	});
});

describe('new deployment contract', () => {
	const failure = {
		code: 'runtime_build_failed',
		category: 'build',
		summary: 'Proses build berhenti.',
		recovery_hint: 'Perbaiki di repository.',
		user_fixable: true,
		detail: 'npm ERR! code 1',
		stage: 'building'
	} as const;

	it('keeps is_active, queue_state, and the failure fields', () => {
		const { data } = parseDeploymentResponse({
			data: { ...validDeployment, status: 'failed', queue_state: 'waiting_for_node', failure }
		});

		expect(data.is_active).toBe(true);
		expect(data.queue_state).toBe('waiting_for_node');
		expect(data.failure).toEqual(failure);
	});

	it('keeps the failure when its stage is outside the contract', () => {
		const result = parseDeploymentResponse({
			data: { ...validDeployment, failure: { ...failure, stage: 'somewhere' } }
		});

		expect(result.data.failure?.summary).toBe(failure.summary);
		expect(result.data.failure?.stage).toBeNull();
	});

	it('cancelDeployment posts to the cancel route and returns the deployment', async () => {
		mockApiRequest.mockResolvedValueOnce({
			data: { ...validDeployment, cancel_requested_at: '2026-09-20T10:00:00Z' }
		});

		const result = await cancelDeployment('proj_1', 'dep_1');

		expect(mockApiRequest).toHaveBeenCalledWith(
			'api/v1/app/projects/proj_1/deployments/dep_1/cancel',
			{ method: 'POST' }
		);
		expect(result.data.cancel_requested_at).toBe('2026-09-20T10:00:00Z');
	});

	it('getDeploymentLogs forwards order and per_page', async () => {
		mockApiRequest.mockResolvedValueOnce({
			data: [],
			links: { first: null, last: null, prev: null, next: null },
			meta: { path: null, per_page: 200, next_cursor: null, prev_cursor: null }
		});

		await getDeploymentLogs('proj_1', 'dep_1', { per_page: 200, order: 'desc' });

		expect(mockApiRequest).toHaveBeenCalledWith(
			'api/v1/app/projects/proj_1/deployments/dep_1/logs',
			{ params: { per_page: 200, order: 'desc' } }
		);
	});
});

describe('real API shapes (from the end-to-end run)', () => {
	const eventsPage = (rows: unknown[]) => ({
		data: rows,
		links: { first: null, last: null, prev: null, next: null },
		meta: { path: null, per_page: 10, next_cursor: null, prev_cursor: null }
	});

	it('reads metadata: [] as nothing, because PHP encodes an empty map as a list', () => {
		const result = parseDeploymentEventsResponse(
			eventsPage([{ ...validDeploymentEvent, metadata: [] }])
		);

		expect(result.data).toHaveLength(1);
		expect(result.data[0].metadata).toBeNull();
	});

	it('keeps metadata that is a real object', () => {
		const result = parseDeploymentEventsResponse(
			eventsPage([{ ...validDeploymentEvent, metadata: { image: 'abc' } }])
		);

		expect(result.data[0].metadata).toEqual({ image: 'abc' });
	});

	it('drops one malformed event, and keeps the rest of the timeline', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const result = parseDeploymentEventsResponse(
			eventsPage([
				{ ...validDeploymentEvent, sequence: 1 },
				{ sequence: 2, level: 'surprise' },
				'not even an object',
				{ ...validDeploymentEvent, sequence: 3 }
			])
		);

		expect(result.data.map((event) => event.sequence)).toEqual([1, 3]);
		expect(warn).toHaveBeenCalledTimes(2);
		warn.mockRestore();
	});

	it('drops one malformed log line, and keeps the others', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const line = {
			sequence: 1,
			stream: 'stdout',
			message: 'ok',
			recorded_at: '2026-09-20T08:41:02Z'
		};
		const result = parseDeploymentLogsResponse(
			eventsPage([line, { ...line, sequence: 2, stream: 'surprise' }])
		);

		expect(result.data.map((row) => row.sequence)).toEqual([1]);
		warn.mockRestore();
	});

	it.each(['requested_resources', 'effective_resources', 'applied_resources', 'failure'])(
		'a page still opens when %s comes as an empty list',
		(field) => {
			const result = parseDeploymentResponse({
				data: { ...validDeployment, [field]: [] }
			});

			expect(result.data[field as 'failure']).toBeNull();
		}
	);

	it.each(['queue_state', 'finalization_deferred_reason'])(
		'a page still opens when %s is a value it does not know',
		(field) => {
			const result = parseDeploymentResponse({
				data: { ...validDeployment, [field]: 'something_new' }
			});

			expect(result.data[field as 'queue_state']).toBeNull();
		}
	);

	it('still refuses a broken envelope, which no single row can explain', () => {
		expect(() => parseDeploymentEventsResponse({ data: 'nope' })).toThrow();
	});
});

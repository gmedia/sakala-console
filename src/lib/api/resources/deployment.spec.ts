import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../client';
import {
	getDeployment,
	getDeploymentEvents,
	getAllDeploymentEvents,
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

	it('melempar error jika applied_resources berbentuk array', () => {
		expect(() =>
			parseDeploymentResponse({
				data: {
					...validDeployment,
					applied_resources: [{ memory_mb: 256 }]
				}
			})
		).toThrow();
	});

	it('melempar error jika applied_resources object tidak lengkap', () => {
		expect(() =>
			parseDeploymentResponse({
				data: {
					...validDeployment,
					applied_resources: { memory_mb: 256, cpu_millis: 500 }
				}
			})
		).toThrow();
	});

	it('melempar error jika response deployment tidak valid', () => {
		expect(() => parseDeploymentResponse({ data: {} })).toThrow();
	});

	it('melempar error jika requested_resources field-nya salah tipe', () => {
		expect(() =>
			parseDeploymentResponse({
				data: {
					...validDeployment,
					requested_resources: {
						memory_mb: 'bukan-angka',
						cpu_millis: 500,
						pids_limit: 128
					}
				}
			})
		).toThrow();
	});

	it('melempar error jika effective_resources.resources tidak lengkap', () => {
		expect(() =>
			parseDeploymentResponse({
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
			})
		).toThrow();
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

	it('melempar error jika finalization_deferred_reason bukan enum valid', () => {
		expect(() =>
			parseDeploymentResponse({
				data: {
					...validDeployment,
					finalization_deferred_reason: 'unknown_value'
				}
			})
		).toThrow();
	});
});

describe('parseDeploymentEventsResponse', () => {
	it('mengembalikan response deployment events yang valid', () => {
		const result = parseDeploymentEventsResponse(validDeploymentEventsResponse);
		expect(result).toEqual(validDeploymentEventsResponse);
	});

	it('melempar error jika level event tidak valid', () => {
		expect(() =>
			parseDeploymentEventsResponse({
				...validDeploymentEventsResponse,
				data: [
					{
						...validDeploymentEvent,
						level: 'debug'
					}
				]
			})
		).toThrow();
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

	it('melempar error jika metadata berbentuk array', () => {
		expect(() =>
			parseDeploymentEventsResponse({
				...validDeploymentEventsResponse,
				data: [
					{
						...validDeploymentEvent,
						metadata: [{ step: 'build' }]
					}
				]
			})
		).toThrow();
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
			{ params: { cursor: undefined } }
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
			{ params: { cursor: undefined } }
		);

		expect(mockApiRequest).toHaveBeenNthCalledWith(
			2,
			'api/v1/app/projects/proj_1/deployments/dep_1/events',
			{ params: { cursor: 'cursor_next' } }
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

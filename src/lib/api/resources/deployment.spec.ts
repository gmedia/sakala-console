import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../client';
import {
	getDeployment,
	getDeploymentEvents,
	parseDeploymentResponse,
	parseDeploymentEventsResponse,
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
	applied_resources: null,
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
	metadata: [{ step: 'build' }],
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

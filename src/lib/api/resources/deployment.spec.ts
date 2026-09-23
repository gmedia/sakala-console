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
	requested_resources: [{ cpu: '1', memory: '512Mi' }],
	effective_resources: [{ cpu: '1', memory: '512Mi' }],
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

	it('melempar error jika response deployment tidak valid', () => {
		expect(() => parseDeploymentResponse({ data: {} })).toThrow();
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

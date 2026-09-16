import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	getProject,
	deleteProject,
	triggerRedeploy,
	getDeployments,
	getEnvironmentVariables
} from './api';
import { apiRequest } from '$lib/api/client';
import { ApiError } from '$lib/api/errors';

vi.mock('$lib/api/client', () => ({
	apiRequest: vi.fn()
}));

const mockedApiRequest = vi.mocked(apiRequest);

describe('Projects API - Error Propagation Regression', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('propagates ApiError on getProject failure without falling back to mock data', async () => {
		const error = new ApiError('Not found', 404);
		mockedApiRequest.mockRejectedValueOnce(error);

		await expect(getProject('unknown-id')).rejects.toThrow(error);
	});

	it('propagates ApiError on deleteProject failure and does NOT swallow error', async () => {
		const error = new ApiError('Unauthorized', 403);
		mockedApiRequest.mockRejectedValueOnce(error);

		await expect(deleteProject('p-1')).rejects.toThrow(error);
	});

	it('propagates ApiError on triggerRedeploy failure without returning mock deployment', async () => {
		const error = new ApiError('Unprocessable Entity', 422);
		mockedApiRequest.mockRejectedValueOnce(error);

		await expect(
			triggerRedeploy('p-1', { branch: 'main', idempotencyKey: 'key-123' })
		).rejects.toThrow(error);
	});

	it('propagates ApiError on getDeployments failure without falling back to mockDeployments', async () => {
		const error = new ApiError('Server error', 500);
		mockedApiRequest.mockRejectedValueOnce(error);

		await expect(getDeployments('p-1')).rejects.toThrow(error);
	});

	it('propagates ApiError on getEnvironmentVariables failure without falling back to mock variables', async () => {
		const error = new ApiError('Forbidden', 403);
		mockedApiRequest.mockRejectedValueOnce(error);

		await expect(getEnvironmentVariables('p-1')).rejects.toThrow(error);
	});
});

describe('Projects API - Deployment Pagination & Filter Regression', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('requests page 2 when page parameter is provided', async () => {
		mockedApiRequest.mockResolvedValueOnce({
			data: [],
			meta: { current_page: 2, last_page: 3, per_page: 6, total: 18, from: 7, to: 12 }
		});

		await getDeployments('p-1', { page: 2 });

		expect(mockedApiRequest).toHaveBeenCalledWith('/api/v1/app/projects/p-1/deployments?page=2');
	});

	it('forwards search parameter to API query string', async () => {
		mockedApiRequest.mockResolvedValueOnce({
			data: [],
			meta: { current_page: 1, last_page: 1, per_page: 6, total: 1, from: 1, to: 1 }
		});

		await getDeployments('p-1', { search: 'feat-login' });

		expect(mockedApiRequest).toHaveBeenCalledWith(
			'/api/v1/app/projects/p-1/deployments?search=feat-login'
		);
	});

	it('forwards filter parameter to API query string', async () => {
		mockedApiRequest.mockResolvedValueOnce({
			data: [],
			meta: { current_page: 1, last_page: 1, per_page: 6, total: 2, from: 1, to: 2 }
		});

		await getDeployments('p-1', { filter: '7_days' });

		expect(mockedApiRequest).toHaveBeenCalledWith(
			'/api/v1/app/projects/p-1/deployments?filter=7_days'
		);
	});

	it('combines page, per_page, search, and filter parameters', async () => {
		const mockResponse = {
			data: [
				{
					id: 'd-1',
					project_id: 'p-1',
					sequence: 2,
					branch: 'main',
					status: 'succeeded' as const,
					trigger: 'manual' as const,
					commit_sha: 'abc1234',
					commit_message: 'fix',
					image_reference: null,
					requested_resources: null,
					effective_resources: null,
					started_at: null,
					finished_at: null,
					cancelled_at: null,
					failure_code: null,
					failure_summary: null,
					created_at: '2026-01-01T00:00:00Z',
					updated_at: '2026-01-01T00:00:00Z'
				}
			],
			meta: { current_page: 2, last_page: 2, per_page: 6, total: 7, from: 7, to: 7 }
		};
		mockedApiRequest.mockResolvedValueOnce(mockResponse);

		const result = await getDeployments('p-1', {
			page: 2,
			per_page: 6,
			search: 'fix',
			filter: '30_days'
		});

		expect(mockedApiRequest).toHaveBeenCalledWith(
			'/api/v1/app/projects/p-1/deployments?page=2&per_page=6&search=fix&filter=30_days'
		);
		expect(result).toEqual(mockResponse);
	});
});

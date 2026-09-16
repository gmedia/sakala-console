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

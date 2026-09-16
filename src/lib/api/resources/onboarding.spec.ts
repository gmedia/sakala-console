import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
	submitOnboardingSource,
	submitOnboardingProfile,
	submitOnboardingCompleted
} from './onboarding';
import { apiRequest } from '../client';

vi.mock('../client', () => ({ apiRequest: vi.fn() }));

const mockedApiRequest = vi.mocked(apiRequest);

const validUserResourceResponse = {
	data: {
		id: 1,
		name: 'Test User',
		username: 'test_user',
		email: 'test@sakala.local',
		avatar_url: null,
		role: 'user',
		onboarding_source: 'github',
		onboarding_role: 'developer',
		onboarding_completed_at: '2026-09-01T00:00:00Z',
		last_login_at: '2026-09-01T00:00:00Z'
	}
};

beforeEach(() => {
	mockedApiRequest.mockReset();
});

describe('submitOnboardingSource', () => {
	it('foward payload to apiRequest', async () => {
		mockedApiRequest.mockResolvedValue(validUserResourceResponse);

		await submitOnboardingSource({ source: 'github' });

		expect(mockedApiRequest).toHaveBeenCalledWith('api/v1/onboarding/source', {
			method: 'POST',
			json: { source: 'github' }
		});
	});

	it('forward skip payload to apiRequest', async () => {
		mockedApiRequest.mockResolvedValue(validUserResourceResponse);

		await submitOnboardingSource({ skip: true });

		expect(mockedApiRequest).toHaveBeenCalledWith('api/v1/onboarding/source', {
			method: 'POST',
			json: { skip: true }
		});
	});

	it('return parsed CurrentUser from response', async () => {
		mockedApiRequest.mockResolvedValue(validUserResourceResponse);

		const result = await submitOnboardingSource({ source: 'campus' });

		expect(result).toEqual(validUserResourceResponse.data);
	});

	it('throw error if response is not valid UserResource', async () => {
		mockedApiRequest.mockResolvedValue({ data: { id: 'bukan-angka' } });

		await expect(submitOnboardingSource({ source: 'other' })).rejects.toThrow();
	});

	it('forward error from apiRequest as-is (e.g., 422 validation)', async () => {
		mockedApiRequest.mockRejectedValue(new Error('422 Unprocessable'));

		await expect(submitOnboardingSource({ source: 'friend' })).rejects.toThrow('422 Unprocessable');
	});
});

describe('submitOnBoardingProfile', () => {
	it('foward payload name & role to apiRequest', async () => {
		mockedApiRequest.mockResolvedValue(validUserResourceResponse);
		await submitOnboardingProfile({ name: 'sakala_programmer', role: 'developer' });
		expect(mockedApiRequest).toHaveBeenCalledWith('api/v1/onboarding/profile', {
			method: 'POST',
			json: { name: 'sakala_programmer', role: 'developer' }
		});
	});

	it('foward payload skip to apiRequest', async () => {
		mockedApiRequest.mockResolvedValue(validUserResourceResponse);
		await submitOnboardingProfile({ skip: true });
		expect(mockedApiRequest).toHaveBeenCalledWith('api/v1/onboarding/profile', {
			method: 'POST',
			json: { skip: true }
		});
	});

	it('return parsed CurrentUser from response', async () => {
		mockedApiRequest.mockResolvedValue(validUserResourceResponse);
		const result = await submitOnboardingProfile({ name: 'sakala_programmer', role: 'architect' });
		expect(result).toEqual(validUserResourceResponse.data);
	});

	it('throw error if response is not valid UserResource', async () => {
		mockedApiRequest.mockResolvedValue({ data: { id: 'bukan-angka' } });
		await expect(
			submitOnboardingProfile({ name: 'sakala_programmer', role: 'devops' })
		).rejects.toThrow();
	});

	it('foward error from apiRequest as-is (e.g., 422 validation)', async () => {
		mockedApiRequest.mockRejectedValue(new Error('422 Unprocessable'));
		await expect(
			submitOnboardingProfile({ name: 'sakala_programmer', role: 'other' })
		).rejects.toThrow('422 Unprocessable');
	});
});

describe('submitOnboardingCompleted', () => {
	it('call apiRequest with correct endpoint and method', async () => {
		mockedApiRequest.mockResolvedValue(validUserResourceResponse);
		await submitOnboardingCompleted();
		expect(mockedApiRequest).toHaveBeenCalledWith('api/v1/onboarding/complete', {
			method: 'POST'
		});
	});

	it('return parsed CurrentUser from response', async () => {
		mockedApiRequest.mockResolvedValue(validUserResourceResponse);
		const result = await submitOnboardingCompleted();
		expect(result).toEqual(validUserResourceResponse.data);
	});

	it('throw error if response is not valid UserResource', async () => {
		mockedApiRequest.mockResolvedValue({ data: { id: 'bukan-angka' } });
		await expect(submitOnboardingCompleted()).rejects.toThrow();
	});

	it('foward error from apiRequest as-is (e.g., 500 server error)', async () => {
		mockedApiRequest.mockRejectedValue(new Error('500 Internal Server Error'));
		await expect(submitOnboardingCompleted()).rejects.toThrow('500 Internal Server Error');
	});
});

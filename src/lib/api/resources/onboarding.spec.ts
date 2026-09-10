import { vi, describe, it, expect, beforeEach } from 'vitest';
import { submitOnboardingSource } from './onboarding';
import { apiRequest } from '../client';

vi.mock('../client', () => ({ apiRequest: vi.fn() }));

const mockedApiRequest = vi.mocked(apiRequest);

const validUserResourceResponse = {
	data: {
		id: 1,
		name: 'Test User',
		email: 'test@sakala.local',
		avatar_url: null,
		role: 'user',
		onboarding_source: 'github',
		onboarding_completed_at: '2026-09-01T00:00:00Z',
		last_login_at: '2026-09-01T00:00:00Z'
	}
};

describe('submitOnboardingSource', () => {
	beforeEach(() => {
		mockedApiRequest.mockReset();
	});

	it('meneruskan payload apa adanya ke apiRequest', async () => {
		mockedApiRequest.mockResolvedValue(validUserResourceResponse);

		await submitOnboardingSource({ source: 'github' });

		expect(mockedApiRequest).toHaveBeenCalledWith('api/v1/onboarding/source', {
			method: 'POST',
			json: { source: 'github' }
		});
	});

	it('meneruskan payload skip apa adanya', async () => {
		mockedApiRequest.mockResolvedValue(validUserResourceResponse);

		await submitOnboardingSource({ skip: 'true' });

		expect(mockedApiRequest).toHaveBeenCalledWith('api/v1/onboarding/source', {
			method: 'POST',
			json: { skip: 'true' }
		});
	});

	it('mengembalikan CurrentUser hasil parse dari response', async () => {
		mockedApiRequest.mockResolvedValue(validUserResourceResponse);

		const result = await submitOnboardingSource({ source: 'campus' });

		expect(result).toEqual(validUserResourceResponse.data);
	});

	it('throw kalau response tidak sesuai kontrak UserResource', async () => {
		mockedApiRequest.mockResolvedValue({ data: { id: 'bukan-angka' } });

		await expect(submitOnboardingSource({ source: 'other' })).rejects.toThrow();
	});

	it('meneruskan error dari apiRequest apa adanya (mis. 422 validation)', async () => {
		mockedApiRequest.mockRejectedValue(new Error('422 Unprocessable'));

		await expect(submitOnboardingSource({ source: 'friend' })).rejects.toThrow('422 Unprocessable');
	});
});

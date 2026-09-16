import { apiRequest } from '../client';
import { parseCurrentUserResponse, type CurrentUser } from './auth';
import type { components } from '../generated/schema';

export type OnboardingSource = components['schemas']['OnboardingSource'];
export type OnboardingProfile = components['schemas']['OnboardingProfile'];
export type StoreOnboardingPayload = components['schemas']['StoreOnboardingSourceRequest'];
export type StoreOnboardingProfilePayload = components['schemas']['StoreOnboardingProfileRequest'];

export async function submitOnboardingSource(
	payload: StoreOnboardingPayload
): Promise<CurrentUser> {
	const response = await apiRequest<unknown>('api/v1/onboarding/source', {
		method: 'POST',
		json: payload
	});

	return parseCurrentUserResponse(response);
}

export async function submitOnboardingProfile(
	payload: StoreOnboardingProfilePayload
): Promise<CurrentUser> {
	const response = await apiRequest<unknown>('api/v1/onboarding/profile', {
		method: 'POST',
		json: payload
	});

	return parseCurrentUserResponse(response);
}

export async function submitOnboardingCompleted(): Promise<CurrentUser> {
	const response = await apiRequest<unknown>('api/v1/onboarding/complete', {
		method: 'POST'
	});
	return parseCurrentUserResponse(response);
}

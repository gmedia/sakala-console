import { apiRequest } from '../client';
import { parseCurrentUserResponse, type CurrentUser } from './auth';
import type { components } from '../generated/schema';

export type OnboardingSource = components['schemas']['OnboardingSource'];
export type StoreOnboardingPayload = components['schemas']['StoreOnboardingSourceRequest'];

export async function submitOnboardingSource(
	payload: StoreOnboardingPayload
): Promise<CurrentUser> {
	const response = await apiRequest<unknown>('api/v1/onboarding/source', {
		method: 'POST',
		json: payload
	});

	return parseCurrentUserResponse(response);
}

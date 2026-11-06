import { apiRequest } from '../client';
import { parseCurrentUserResponse, type CurrentUser } from './auth';

export type UpdateProfilePayload = {
	name?: string;
	username?: string;
};

export async function updateProfile(payload: UpdateProfilePayload): Promise<CurrentUser> {
	const response = await apiRequest<unknown>('api/v1/app/profile', {
		method: 'PATCH',
		json: payload
	});
	return parseCurrentUserResponse(response);
}

/**
 * PHP only parses multipart bodies on POST, so a real PATCH would reach Laravel with no file.
 * `_method` makes Laravel route this POST to the same `PATCH app/profile`.
 */
export async function uploadAvatar(file: File): Promise<CurrentUser> {
	const body = new FormData();
	body.set('_method', 'PATCH');
	body.set('avatar', file);

	const response = await apiRequest<unknown>('api/v1/app/profile', {
		method: 'POST',
		body
	});
	return parseCurrentUserResponse(response);
}

export async function removeAvatar(): Promise<CurrentUser> {
	const response = await apiRequest<unknown>('api/v1/app/profile/avatar', {
		method: 'DELETE'
	});
	return parseCurrentUserResponse(response);
}

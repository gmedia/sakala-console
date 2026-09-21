import { z } from 'zod';
import { apiRequest } from '../client';
import type { components, operations } from '../generated/schema';

export type CurrentUser = components['schemas']['UserResource'];

type CurrentUserResponse =
	operations['v1.auth.user']['responses'][200]['content']['application/json'];

const currentUserSchema = z.object({
	id: z.number(),
	name: z.string(),
	username: z.string(),
	email: z.string().email(),
	avatar_url: z.string().url().nullable(),
	role: z.string(),
	onboarding_source: z.string().nullable(),
	onboarding_role: z.string().nullable(),
	onboarding_completed_at: z.string().nullable(),
	last_login_at: z.string().nullable()
}) satisfies z.ZodType<CurrentUser>;

const currentUserResponseSchema = z.object({
	data: currentUserSchema
}) satisfies z.ZodType<CurrentUserResponse>;

export async function getCurrentUser(): Promise<CurrentUser> {
	const response = await apiRequest<unknown>('api/v1/auth/user');
	return parseCurrentUserResponse(response);
}

export function parseCurrentUserResponse(response: unknown): CurrentUser {
	return currentUserResponseSchema.parse(response).data;
}

export async function logout(): Promise<void> {
	await apiRequest<void>('api/v1/auth/logout', {
		method: 'POST'
	});
}

export type LoginPayload = {
	email: string;
	password: string;
};

export type RegisterPayload = {
	name: string;
	email: string;
	password: string;
	password_confirmation: string;
};

export async function login(payload: LoginPayload): Promise<CurrentUser> {
	const response = await apiRequest<unknown>('api/v1/auth/login', {
		method: 'POST',
		json: payload
	});
	return parseCurrentUserResponse(response);
}

export async function register(payload: RegisterPayload): Promise<void> {
	await apiRequest<unknown>('api/v1/auth/register', {
		method: 'POST',
		json: payload
	});
}

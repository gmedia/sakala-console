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
	last_login_at: z.string().nullable(),
	has_password: z.boolean(),
	pending_email: z.string().nullable(),
	created_at: z.string().nullable()
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

export type AuthOptions = components['schemas']['AuthOptionsResource'];

type AuthOptionsResponse =
	operations['v1.auth.options']['responses'][200]['content']['application/json'];

const authOptionsResponseSchema = z.object({
	data: z.object({
		email_delivery_enabled: z.boolean(),
		providers: z.object({ github: z.boolean(), google: z.boolean() })
	})
}) satisfies z.ZodType<AuthOptionsResponse>;

/** Public, so the signed-out login page can read which sign-in options exist. */
export async function getAuthOptions(): Promise<AuthOptions> {
	const response = await apiRequest<unknown>('api/v1/auth/options');
	return authOptionsResponseSchema.parse(response).data;
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

/** The answer is generic: it does not say whether the email exists or is already verified. */
export async function resendVerificationEmail(email: string): Promise<void> {
	await apiRequest<unknown>('api/v1/auth/email/verification-notification', {
		method: 'POST',
		json: { email }
	});
}

/** Always 202 with the same body, whether or not the email is registered. */
export async function forgotPassword(email: string): Promise<void> {
	await apiRequest<unknown>('api/v1/auth/forgot-password', {
		method: 'POST',
		json: { email }
	});
}

export type ResetPasswordPayload = components['schemas']['ResetPasswordRequest'];

export async function resetPassword(payload: ResetPasswordPayload): Promise<void> {
	await apiRequest<void>('api/v1/auth/reset-password', {
		method: 'POST',
		json: payload
	});
}

/** An account without a password (`has_password` false) sets its first one and omits the current. */
export type ChangePasswordPayload = Omit<
	components['schemas']['ChangePasswordRequest'],
	'current_password'
> & { current_password?: string };

export async function changePassword(payload: ChangePasswordPayload): Promise<CurrentUser> {
	const response = await apiRequest<unknown>('api/v1/auth/password', {
		method: 'PUT',
		json: payload
	});
	return parseCurrentUserResponse(response);
}

export type RequestEmailChangePayload = components['schemas']['RequestEmailChangeRequest'];

/** Answers 202 with `pending_email` set; the email only changes once the new address confirms. */
export async function requestEmailChange(payload: RequestEmailChangePayload): Promise<CurrentUser> {
	const response = await apiRequest<unknown>('api/v1/auth/email/change', {
		method: 'POST',
		json: payload
	});
	return parseCurrentUserResponse(response);
}

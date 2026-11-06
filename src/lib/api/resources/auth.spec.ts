import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	parseCurrentUserResponse,
	login,
	register,
	changePassword,
	forgotPassword,
	getAuthOptions,
	requestEmailChange,
	resendVerificationEmail,
	resetPassword
} from './auth';
import { apiRequest } from '../client';

vi.mock('../client', () => ({ apiRequest: vi.fn() }));
const mockedApiRequest = vi.mocked(apiRequest);

beforeEach(() => {
	mockedApiRequest.mockReset();
});

describe('Auth Resource', () => {
	it('successfully parses a valid API response', () => {
		const validPayload = {
			data: {
				id: 1,
				name: 'Developer',
				username: 'developer123',
				email: 'dev@example.com',
				avatar_url: null,
				role: 'user',
				onboarding_source: 'github',
				onboarding_role: 'developer',
				onboarding_completed_at: '2026-08-25T10:00:00Z',
				last_login_at: '2026-08-25T10:00:00Z',
				has_password: true,
				pending_email: null,
				created_at: '2026-01-01T00:00:00Z'
			}
		};

		const result = parseCurrentUserResponse(validPayload);

		expect(result.id).toBe(1);
		expect(result.name).toBe('Developer');
		expect(result.avatar_url).toBeNull();
		expect(result.role).toBe('user');
		expect(result.onboarding_source).toBe('github');
		expect(result.onboarding_completed_at).toBe('2026-08-25T10:00:00Z');
		expect(result.last_login_at).toBe('2026-08-25T10:00:00Z');
	});

	it('successfully parses a valid API response with null fields', () => {
		const userPayload = {
			data: {
				id: 2,
				name: 'Fresh User',
				username: 'freshuser',
				email: 'fresh@example.com',
				avatar_url: null,
				role: 'user',
				onboarding_source: null,
				onboarding_role: 'developer',
				onboarding_completed_at: null,
				last_login_at: null,
				has_password: true,
				pending_email: null,
				created_at: '2026-01-01T00:00:00Z'
			}
		};

		const result = parseCurrentUserResponse(userPayload);
		expect(result.id).toBe(2);
		expect(result.name).toBe('Fresh User');
		expect(result.username).toBe('freshuser');
		expect(result.onboarding_source).toBeNull();
		expect(result.onboarding_completed_at).toBeNull();
		expect(result.last_login_at).toBeNull();
	});

	it('failed and throws an error when parsing an invalid API response', () => {
		const invalidPayload = {
			data: {
				id: '2',
				name: 'Tester',
				email: 'invalid-email'
			}
		};

		expect(() => parseCurrentUserResponse(invalidPayload)).toThrow();
	});

	it('calls api/v1/auth/login and returns parsed user', async () => {
		const userPayload = {
			data: {
				id: 1,
				name: 'User',
				username: 'user1',
				email: 'user@example.com',
				avatar_url: null,
				role: 'user',
				onboarding_source: null,
				onboarding_role: null,
				onboarding_completed_at: null,
				last_login_at: null,
				has_password: true,
				pending_email: null,
				created_at: '2026-01-01T00:00:00Z'
			}
		};
		mockedApiRequest.mockResolvedValue(userPayload);

		const result = await login({ email: 'user@example.com', password: 'password123' });

		expect(mockedApiRequest).toHaveBeenCalledWith('api/v1/auth/login', {
			method: 'POST',
			json: { email: 'user@example.com', password: 'password123' }
		});
		expect(result.id).toBe(1);
		expect(result.email).toBe('user@example.com');
	});

	it('calls api/v1/auth/register with registration payload', async () => {
		mockedApiRequest.mockResolvedValue(undefined);

		await register({
			name: 'Budi Santoso',
			email: 'budi@example.com',
			password: 'password123',
			password_confirmation: 'password123'
		});

		expect(mockedApiRequest).toHaveBeenCalledWith('api/v1/auth/register', {
			method: 'POST',
			json: {
				name: 'Budi Santoso',
				email: 'budi@example.com',
				password: 'password123',
				password_confirmation: 'password123'
			}
		});
	});
});

describe('account security endpoints (U-07, U-32, U-33)', () => {
	const user = {
		id: 1,
		name: 'Rani',
		username: 'rani',
		email: 'rani@sakala.local',
		avatar_url: null,
		role: 'user',
		onboarding_source: null,
		onboarding_role: null,
		onboarding_completed_at: null,
		last_login_at: null,
		has_password: true,
		pending_email: 'baru@sakala.local',
		created_at: null
	};

	it('resends verification with only the email, without a session', async () => {
		mockedApiRequest.mockResolvedValue({ data: { request_accepted: true } });

		await resendVerificationEmail('rani@sakala.local');

		expect(mockedApiRequest).toHaveBeenCalledWith('api/v1/auth/email/verification-notification', {
			method: 'POST',
			json: { email: 'rani@sakala.local' }
		});
	});

	it('requests a reset link', async () => {
		mockedApiRequest.mockResolvedValue({ data: { request_accepted: true } });

		await forgotPassword('rani@sakala.local');

		expect(mockedApiRequest).toHaveBeenCalledWith('api/v1/auth/forgot-password', {
			method: 'POST',
			json: { email: 'rani@sakala.local' }
		});
	});

	it('sends the reset token in the body, not the URL', async () => {
		mockedApiRequest.mockResolvedValue(undefined);
		const payload = {
			token: 'rahasia',
			email: 'rani@sakala.local',
			password: 'kata-sandi-baru',
			password_confirmation: 'kata-sandi-baru'
		};

		await resetPassword(payload);

		const [path, options] = mockedApiRequest.mock.calls[0];
		expect(path).toBe('api/v1/auth/reset-password');
		expect(path).not.toContain('rahasia');
		expect(options?.json).toEqual(payload);
	});

	it('changes the password with PUT and returns the user', async () => {
		mockedApiRequest.mockResolvedValue({ data: user });

		const result = await changePassword({
			password: 'kata-sandi-baru',
			password_confirmation: 'kata-sandi-baru'
		});

		expect(mockedApiRequest).toHaveBeenCalledWith('api/v1/auth/password', {
			method: 'PUT',
			json: { password: 'kata-sandi-baru', password_confirmation: 'kata-sandi-baru' }
		});
		expect(result.id).toBe(1);
	});

	it('requests an email change and returns pending_email', async () => {
		mockedApiRequest.mockResolvedValue({ data: user });

		const result = await requestEmailChange({
			email: 'baru@sakala.local',
			current_password: 'kata-sandi'
		});

		expect(mockedApiRequest).toHaveBeenCalledWith('api/v1/auth/email/change', {
			method: 'POST',
			json: { email: 'baru@sakala.local', current_password: 'kata-sandi' }
		});
		expect(result.pending_email).toBe('baru@sakala.local');
	});
});

describe('getAuthOptions', () => {
	const options = { email_delivery_enabled: false, providers: { github: true, google: false } };

	it('reads the public options', async () => {
		mockedApiRequest.mockResolvedValue({ data: options });

		await expect(getAuthOptions()).resolves.toEqual(options);
		expect(mockedApiRequest).toHaveBeenCalledWith('api/v1/auth/options');
	});

	it('rejects a body it cannot trust, so the page falls back instead of guessing', async () => {
		mockedApiRequest.mockResolvedValue({ data: { email_delivery_enabled: 'no' } });

		await expect(getAuthOptions()).rejects.toThrow();
	});
});

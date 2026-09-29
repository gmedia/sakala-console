import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseCurrentUserResponse, login, register } from './auth';
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
				last_login_at: '2026-08-25T10:00:00Z'
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
				last_login_at: null
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
				last_login_at: null
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

import { describe, it, expect } from 'vitest';
import { parseCurrentUserResponse } from './auth';

describe('Auth Resource', () => {
	it('successfully parses a valid API response', () => {
		const validPayload = {
			data: {
				id: 1,
				name: 'Developer',
				email: 'dev@example.com',
				avatar_url: null,
				role: 'user',
				onboarding_source: 'github',
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
				email: 'fresh@example.com',
				avatar_url: null,
				role: 'user',
				onboarding_source: null,
				onboarding_completed_at: null,
				last_login_at: null
			}
		};

		const result = parseCurrentUserResponse(userPayload);
		expect(result.id).toBe(2);
		expect(result.name).toBe('Fresh User');
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
});

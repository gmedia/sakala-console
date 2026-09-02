import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockEnv = vi.hoisted(() => ({}) as Record<string, string | undefined>);

vi.mock('$env/dynamic/public', () => ({ env: mockEnv }));

import { getRealtimeEnv } from './env';

describe('getRealtimeEnv', () => {
	beforeEach(() => {
		for (const key of Object.keys(mockEnv)) delete mockEnv[key];
	});

	it('returns null when all environment variables are missing', () => {
		expect(getRealtimeEnv()).toBeNull();
	});

	it('returns null when PUBLIC_REVERB_KEY is an empty string', () => {
		Object.assign(mockEnv, {
			PUBLIC_REVERB_HOST: 'api.staging.sakala.dev',
			PUBLIC_REVERB_KEY: '',
			PUBLIC_REVERB_PORT: '443',
			PUBLIC_REVERB_SCHEME: 'https'
		});
		expect(getRealtimeEnv()).toBeNull();
	});

	it('returns null when PUBLIC_REVERB_SCHEME is not one of the allowed values', () => {
		Object.assign(mockEnv, {
			PUBLIC_REVERB_HOST: 'api.staging.sakala.dev',
			PUBLIC_REVERB_KEY: 'abc123',
			PUBLIC_REVERB_PORT: '443',
			PUBLIC_REVERB_SCHEME: 'ftp'
		});
		expect(getRealtimeEnv()).toBeNull();
	});

	it('returns null when PUBLIC_REVERB_PORT is not a positive integer', () => {
		Object.assign(mockEnv, {
			PUBLIC_REVERB_HOST: 'api.staging.sakala.dev',
			PUBLIC_REVERB_KEY: 'abc123',
			PUBLIC_REVERB_PORT: '-1',
			PUBLIC_REVERB_SCHEME: 'https'
		});
		expect(getRealtimeEnv()).toBeNull();
	});

	it('returns a valid object when all environment variables are present and valid', () => {
		Object.assign(mockEnv, {
			PUBLIC_REVERB_HOST: 'api.staging.sakala.dev',
			PUBLIC_REVERB_KEY: 'abc123',
			PUBLIC_REVERB_PORT: '443',
			PUBLIC_REVERB_SCHEME: 'https'
		});
		expect(getRealtimeEnv()).toEqual({
			host: 'api.staging.sakala.dev',
			key: 'abc123',
			port: 443,
			scheme: 'https'
		});
	});

	it('accepts all four valid schemes: http, https', () => {
		for (const scheme of ['http', 'https']) {
			Object.assign(mockEnv, {
				PUBLIC_REVERB_HOST: 'api.staging.sakala.dev',
				PUBLIC_REVERB_KEY: 'abc123',
				PUBLIC_REVERB_PORT: '443',
				PUBLIC_REVERB_SCHEME: scheme
			});
			expect(getRealtimeEnv()?.scheme).toBe(scheme);
		}
	});
});

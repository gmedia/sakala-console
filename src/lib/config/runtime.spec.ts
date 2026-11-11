import { afterEach, describe, expect, it, vi } from 'vitest';
import { RUNTIME_CONFIG_GLOBAL, isHttpUrl, readRuntimeConfig, withRuntimeConfig } from './runtime';

const windowWith = (config: unknown) => ({ [RUNTIME_CONFIG_GLOBAL]: config });

describe('readRuntimeConfig', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('returns nothing when the container rendered no settings', () => {
		expect(readRuntimeConfig({})).toEqual({});
		expect(readRuntimeConfig(windowWith({}))).toEqual({});
		expect(readRuntimeConfig(windowWith(null))).toEqual({});
	});

	it('keeps every valid public setting', () => {
		const config = {
			PUBLIC_API_URL: 'https://api.example.com',
			PUBLIC_APP_URL: 'https://app.example.com',
			PUBLIC_REVERB_HOST: 'api.example.com',
			PUBLIC_REVERB_PORT: '443',
			PUBLIC_REVERB_SCHEME: 'https',
			PUBLIC_REVERB_KEY: 'abc123'
		};
		expect(readRuntimeConfig(windowWith(config))).toEqual(config);
	});

	it('keeps an empty Reverb key, which switches realtime off', () => {
		expect(readRuntimeConfig(windowWith({ PUBLIC_REVERB_KEY: '' }))).toEqual({
			PUBLIC_REVERB_KEY: ''
		});
	});

	it('drops values that are not web origins or not well formed, and says so', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const config = {
			PUBLIC_API_URL: 'javascript:alert(1)',
			PUBLIC_APP_URL: 'ftp://app.example.com',
			PUBLIC_REVERB_HOST: 'evil.example.com; script-src *',
			PUBLIC_REVERB_PORT: '70000',
			PUBLIC_REVERB_SCHEME: 'wss',
			PUBLIC_REVERB_KEY: 'has space'
		};
		expect(readRuntimeConfig(windowWith(config))).toEqual({});
		expect(warn).toHaveBeenCalledTimes(6);
	});

	it('ignores values that are not strings and keys it does not know', () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const config = { PUBLIC_REVERB_PORT: 443, PUBLIC_SOMETHING_ELSE: 'x', toString: 'y' };
		expect(readRuntimeConfig(windowWith(config))).toEqual({});
	});

	it('ignores a global that is not a plain object', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		expect(readRuntimeConfig(windowWith('https://api.example.com'))).toEqual({});
		expect(readRuntimeConfig(windowWith(['https://api.example.com']))).toEqual({});
		expect(warn).toHaveBeenCalledTimes(2);
	});

	it('reads the window global by default', () => {
		vi.stubGlobal(RUNTIME_CONFIG_GLOBAL, { PUBLIC_API_URL: 'http://api.example.test:8000' });
		try {
			expect(readRuntimeConfig()).toEqual({ PUBLIC_API_URL: 'http://api.example.test:8000' });
		} finally {
			vi.unstubAllGlobals();
		}
	});
});

describe('withRuntimeConfig', () => {
	it('lets runtime values win key by key and keeps the rest from the build', () => {
		const buildTime = {
			PUBLIC_API_URL: 'https://api.sakala.dev',
			PUBLIC_REVERB_KEY: 'built-key',
			PUBLIC_REVERB_HOST: 'api.sakala.dev'
		};
		expect(
			withRuntimeConfig(buildTime, {
				PUBLIC_API_URL: 'https://api.example.com',
				PUBLIC_REVERB_KEY: ''
			})
		).toEqual({
			PUBLIC_API_URL: 'https://api.example.com',
			PUBLIC_REVERB_KEY: '',
			PUBLIC_REVERB_HOST: 'api.sakala.dev'
		});
	});

	it('changes nothing when the runtime sets nothing', () => {
		const buildTime = { PUBLIC_API_URL: 'https://api.sakala.dev', PUBLIC_APP_URL: undefined };
		expect(withRuntimeConfig(buildTime, {})).toEqual(buildTime);
	});
});

describe('isHttpUrl', () => {
	it('accepts http and https only', () => {
		expect(isHttpUrl('https://api.example.com/base')).toBe(true);
		expect(isHttpUrl('http://127.0.0.1:8000')).toBe(true);
		expect(isHttpUrl('ws://api.example.com')).toBe(false);
		expect(isHttpUrl('data:text/html,hi')).toBe(false);
		expect(isHttpUrl('not a url')).toBe(false);
	});
});

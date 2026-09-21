import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { isValidInternalPath, getLastLoginProvider, setLastLoginProvider } from './oauth';

describe('isValidInternalPath', () => {
	it('returns true for valid internal paths', () => {
		expect(isValidInternalPath('/projects')).toBe(true);
		expect(isValidInternalPath('/settings/account')).toBe(true);
		expect(isValidInternalPath('/onboarding?step=2')).toBe(true);
		expect(isValidInternalPath('/path/to/resource#section')).toBe(true);
	});

	it('returns false for null, undefined, or empty values', () => {
		expect(isValidInternalPath(null)).toBe(false);
		expect(isValidInternalPath(undefined)).toBe(false);
		expect(isValidInternalPath('')).toBe(false);
	});

	it('returns false for external absolute URLs', () => {
		expect(isValidInternalPath('http://example.com')).toBe(false);
		expect(isValidInternalPath('https://example.com/projects')).toBe(false);
		expect(isValidInternalPath('//example.com')).toBe(false);
		expect(isValidInternalPath('//example.com/login')).toBe(false);
	});

	it('returns false for backslash and URL normalization open redirect vectors', () => {
		expect(isValidInternalPath('/\\example.com')).toBe(false);
		expect(isValidInternalPath('/\\example.com/path')).toBe(false);
		expect(isValidInternalPath('/%5Cexample.com')).toBe(false);
		expect(isValidInternalPath('/foo\\bar')).toBe(false);
	});

	it('returns false for non-path protocols or malicious schemes', () => {
		expect(isValidInternalPath('javascript:alert(1)')).toBe(false);
		expect(isValidInternalPath('data:text/html,test')).toBe(false);
		expect(isValidInternalPath('projects')).toBe(false);
	});
});

describe('last login provider storage', () => {
	let store: Record<string, string> = {};

	beforeEach(() => {
		store = {};
		const mockStorage = {
			getItem: (key: string) => store[key] ?? null,
			setItem: (key: string, val: string) => {
				store[key] = val;
			},
			removeItem: (key: string) => {
				delete store[key];
			},
			clear: () => {
				store = {};
			}
		};
		vi.stubGlobal('window', { localStorage: mockStorage });
		vi.stubGlobal('localStorage', mockStorage);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('returns null when no last login provider is set', () => {
		expect(getLastLoginProvider()).toBeNull();
	});

	it('sets and retrieves last login provider correctly', () => {
		setLastLoginProvider('google');
		expect(getLastLoginProvider()).toBe('google');

		setLastLoginProvider('github');
		expect(getLastLoginProvider()).toBe('github');

		setLastLoginProvider('email');
		expect(getLastLoginProvider()).toBe('email');
	});

	it('returns null for unknown provider strings', () => {
		localStorage.setItem('last_login_provider', 'facebook');
		expect(getLastLoginProvider()).toBeNull();
	});
});

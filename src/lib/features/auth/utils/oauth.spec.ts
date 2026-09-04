import { describe, expect, it } from 'vitest';
import { isValidInternalPath } from './oauth';

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

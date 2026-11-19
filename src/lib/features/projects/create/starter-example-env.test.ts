import { describe, expect, it } from 'vitest';
import { resolveStarterEnvValue } from './starter-example-env';

describe('resolveStarterEnvValue', () => {
	it('makes a Laravel key of 32 random bytes, different every time', () => {
		const first = resolveStarterEnvValue({ kind: 'laravel-app-key' });
		const second = resolveStarterEnvValue({ kind: 'laravel-app-key' });
		expect(first).toMatch(/^base64:[A-Za-z0-9+/]{43}=$/);
		expect(atob(first.slice('base64:'.length))).toHaveLength(32);
		expect(first).not.toBe(second);
	});

	it('passes a fixed value through', () => {
		expect(resolveStarterEnvValue({ kind: 'fixed', value: 'production' })).toBe('production');
	});
});

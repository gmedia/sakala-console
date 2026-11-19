import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	generateSecret,
	GENERIC_SECRET_BYTES,
	LARAVEL_KEY_BYTES,
	SECRET_FORMATS,
	SECRET_KEY_BASE_BYTES
} from './secret-generation';

function base64UrlToBytes(value: string): number {
	const padded = value.replace(/-/g, '+').replace(/_/g, '/');
	return atob(padded + '='.repeat((4 - (padded.length % 4)) % 4)).length;
}

afterEach(() => vi.restoreAllMocks());

describe('generateSecret', () => {
	it('makes a Laravel APP_KEY: base64: and 32 bytes', () => {
		const key = generateSecret(SECRET_FORMATS.laravelAppKey);
		expect(key).toMatch(/^base64:[A-Za-z0-9+/]{43}=$/);
		expect(atob(key.slice('base64:'.length))).toHaveLength(LARAVEL_KEY_BYTES);
	});

	it('makes a SECRET_KEY_BASE of 64 bytes as 128 lowercase hex characters', () => {
		const key = generateSecret(SECRET_FORMATS.hex64);
		expect(key).toMatch(/^[0-9a-f]{128}$/);
		expect(key.length / 2).toBe(SECRET_KEY_BASE_BYTES);
	});

	it('makes a generic secret of 32 bytes as unpadded base64url', () => {
		const key = generateSecret(SECRET_FORMATS.base64url32);
		expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);
		expect(base64UrlToBytes(key)).toBe(GENERIC_SECRET_BYTES);
	});

	it.each(Object.values(SECRET_FORMATS))('draws %s from crypto.getRandomValues', (format) => {
		const spy = vi.spyOn(crypto, 'getRandomValues');
		const first = generateSecret(format);
		const second = generateSecret(format);
		expect(spy).toHaveBeenCalledTimes(2);
		expect(first).not.toBe(second);
	});

	it('keeps every byte value, including the ones base64 and hex pad', () => {
		vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
			const bytes = array as Uint8Array;
			bytes.fill(0);
			bytes[bytes.length - 1] = 0xff;
			return array;
		});
		expect(generateSecret(SECRET_FORMATS.hex64)).toBe(`${'00'.repeat(63)}ff`);
		expect(generateSecret(SECRET_FORMATS.base64url32).endsWith('AP8')).toBe(true);
	});
});

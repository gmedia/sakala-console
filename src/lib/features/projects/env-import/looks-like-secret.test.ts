import { describe, expect, it } from 'vitest';
import { looksLikeSecret } from './looks-like-secret';

describe('looksLikeSecret', () => {
	it.each([
		['DB_PASSWORD', 'kopi'],
		['JWT_SECRET', 'abc'],
		['GITHUB_TOKEN', 'abc'],
		['STRIPE_API_KEY', 'abc'],
		['APP_KEY', 'abc'],
		['AWS_ACCESS_KEY_ID', 'abc'],
		['SENTRY_DSN', 'https://x@o1.ingest.sentry.io/1'],
		['SESSION_KEY', 'abc']
	])('flags %s by its name', (key, value) => {
		expect(looksLikeSecret(key, value)).toBe(true);
	});

	it.each([
		['DATABASE_URL', 'postgres://kopi:rahasia@db.local:5432/kopi'],
		['GH', 'ghp_abcdefghijklmnopqrstuvwxyz0123456789'],
		['PAYMENT', 'sk_live_abcdefghijklmnop'],
		['CLOUD', 'AKIAIOSFODNN7EXAMPLE'],
		['X', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl'],
		['LARAVEL', 'base64:2fl+Ktvkfl+Fuz4Qp/A75G2RTiWVA/ZoKZvp6fiiM10='],
		['CERT', '-----BEGIN RSA PRIVATE KEY-----\nabc']
	])('flags %s by its value', (key, value) => {
		expect(looksLikeSecret(key, value)).toBe(true);
	});

	it.each([
		['APP_ENV', 'production'],
		['APP_DEBUG', 'false'],
		['NODE_ENV', 'production'],
		['APP_URL', 'https://toko-kopi.sakala.app'],
		['MONKEY_COUNT', '3'],
		['DATABASE_URL', 'postgres://db.local:5432/kopi']
	])('leaves %s alone', (key, value) => {
		expect(looksLikeSecret(key, value)).toBe(false);
	});
});

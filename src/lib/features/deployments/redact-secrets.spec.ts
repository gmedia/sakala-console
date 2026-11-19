import { describe, expect, it } from 'vitest';
import { REDACTED, redactSecrets } from './redact-secrets';

describe('redactSecrets', () => {
	it.each([
		[
			'Reading postgres://kopi:rahasia-sekali@db.internal:5432/kopi',
			`Reading postgres://kopi:${REDACTED}@db.internal:5432/kopi`
		],
		['DB_PASSWORD=rahasia', `DB_PASSWORD=${REDACTED}`],
		['export STRIPE_SECRET_KEY="sk_live_abc 123"', `export STRIPE_SECRET_KEY=${REDACTED}`],
		['APP_KEY: base64:2fl+Ktvkfl+Fuz4Qp/A75G2RTiWVA/ZoKZvp6fiiM10=', `APP_KEY: ${REDACTED}`],
		['Authorization: Bearer abcdefghijklmnop', `Authorization: Bearer ${REDACTED}`],
		['token ghp_abcdefghijklmnopqrstuvwxyz0123456789 used', `token ${REDACTED} used`],
		['key AKIAIOSFODNN7EXAMPLE', `key ${REDACTED}`],
		['jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl', `jwt ${REDACTED}`],
		['-----BEGIN PRIVATE KEY-----\nMIIEv\n-----END PRIVATE KEY-----', REDACTED]
	])('masks %s', (input, output) => {
		expect(redactSecrets(input)).toBe(output);
	});

	it.each([
		'#6 3.410 error during build:',
		'npm warn deprecated inflight@1.0.6',
		'Server listening on port 3000',
		'https://registry.npmjs.org/vite',
		'NODE_ENV=production'
	])('leaves ordinary log text alone: %s', (input) => {
		expect(redactSecrets(input)).toBe(input);
	});
});

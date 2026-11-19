import { describe, expect, it } from 'vitest';
import { looksLikeEnvFile, parseEnvText } from './parse-env-text';

const LARAVEL_ENV = `# Laravel
APP_NAME="Toko Kopi"
APP_ENV=production
APP_KEY=base64:2fl+Ktvkfl+Fuz4Qp/A75G2RTiWVA/ZoKZvp6fiiM10=
APP_DEBUG=false

export DB_CONNECTION=pgsql
DATABASE_URL='postgres://kopi:rahasia@db.local:5432/kopi'
MAIL_FROM_ADDRESS=  # filled later
PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBg
-----END PRIVATE KEY-----"
PORT=8000
app-url=http://localhost
just some words
`;

describe('parseEnvText', () => {
	it('reads quoted, exported and multi-line values the way dotenv does', () => {
		const result = parseEnvText(LARAVEL_ENV);
		expect(result.entries.map((entry) => entry.key)).toEqual([
			'APP_NAME',
			'APP_ENV',
			'APP_KEY',
			'APP_DEBUG',
			'DB_CONNECTION',
			'DATABASE_URL',
			'PRIVATE_KEY'
		]);
		expect(result.entries[0].value).toBe('Toko Kopi');
		expect(result.entries.find((entry) => entry.key === 'PRIVATE_KEY')?.value).toContain(
			'\nMIIEvQIBADANBg\n'
		);
	});

	it('keeps PORT out of the variables and reports its value', () => {
		expect(parseEnvText(LARAVEL_ENV).port).toBe('8000');
		expect(parseEnvText('A=1').port).toBeNull();
	});

	it('names what it skipped and why, instead of dropping it quietly', () => {
		expect(parseEnvText(LARAVEL_ENV).skipped).toEqual([
			{ key: 'MAIL_FROM_ADDRESS', reason: 'empty_value' },
			{ key: 'app-url', reason: 'invalid_key' }
		]);
	});

	it('counts lines it could not read, but not the lines inside a quoted value', () => {
		expect(parseEnvText(LARAVEL_ENV).unreadableLines).toBe(1);
	});

	it('keeps the last value of a key written twice, like dotenv', () => {
		expect(parseEnvText('A=1\nA=2').entries).toEqual([{ key: 'A', value: '2' }]);
	});

	it('handles Windows line endings', () => {
		expect(parseEnvText('A=1\r\nB=2\r\n').entries).toEqual([
			{ key: 'A', value: '1' },
			{ key: 'B', value: '2' }
		]);
	});
});

describe('looksLikeEnvFile', () => {
	it('is true for several lines with an assignment', () => {
		expect(looksLikeEnvFile('A=1\nB=2')).toBe(true);
		expect(looksLikeEnvFile('# comment\nA=1')).toBe(true);
	});

	it('is false for one line or for text without assignments', () => {
		expect(looksLikeEnvFile('A=1')).toBe(false);
		expect(looksLikeEnvFile('DATABASE_URL')).toBe(false);
		expect(looksLikeEnvFile('hello\nworld')).toBe(false);
	});
});

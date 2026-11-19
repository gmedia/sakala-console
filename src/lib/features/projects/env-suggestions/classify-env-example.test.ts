import { describe, expect, it } from 'vitest';
import { SECRET_FORMATS } from '../secret-generation';
import {
	classifyEnvExample,
	hasStorableSuggestions,
	normalizeExampleValue,
	rowsInGroup,
	type EnvSuggestionContext
} from './classify-env-example';

const context: EnvSuggestionContext = {
	publicUrl: 'https://toko-kopi.sakala.app',
	databaseProvided: false,
	existingKeys: []
};

const entry = (key: string, example_value: string | null) => ({ key, example_value });

/** A trimmed Laravel 12 .env.example, as the agent sends it. */
const LARAVEL = [
	entry('APP_NAME', 'Laravel'),
	entry('APP_ENV', 'local'),
	entry('APP_KEY', null),
	entry('APP_DEBUG', 'true'),
	entry('APP_URL', 'http://localhost'),
	entry('LOG_LEVEL', 'debug'),
	entry('DB_CONNECTION', 'sqlite'),
	entry('DB_HOST', '127.0.0.1'),
	entry('DB_URL', null),
	entry('SESSION_DOMAIN', 'null'),
	entry('REDIS_PASSWORD', 'null'),
	entry('MAIL_HOST', '127.0.0.1'),
	entry('MAIL_PASSWORD', 'null'),
	entry('MAIL_FROM_NAME', '${APP_NAME}'),
	entry('AWS_SECRET_ACCESS_KEY', null),
	entry('PORT', '8000')
];

function find(rows: ReturnType<typeof classifyEnvExample>['rows'], key: string) {
	const row = rows.find((item) => item.key === key);
	if (!row) throw new Error(`${key} missing`);
	return row;
}

describe('classifyEnvExample, by group', () => {
	it('puts PORT under Diisi Sakala always, and nothing of it is stored', () => {
		const { rows } = classifyEnvExample(LARAVEL, context);
		expect(find(rows, 'PORT')).toEqual({ group: 'platform', key: 'PORT', source: 'port' });
	});

	it('generates the signing keys, each in its framework format', () => {
		const { rows } = classifyEnvExample(
			[
				entry('APP_KEY', null),
				entry('SECRET_KEY_BASE', 'changeme'),
				entry('NEXTAUTH_SECRET', ''),
				entry('JWT_SECRET', 'base64:2fl+Ktvkfl+Fuz4Qp/A75G2RTiWVA/ZoKZvp6fiiM10=')
			],
			context
		);
		expect(rowsInGroup(rows, 'generated')).toEqual([
			{ group: 'generated', key: 'APP_KEY', format: SECRET_FORMATS.laravelAppKey },
			{ group: 'generated', key: 'SECRET_KEY_BASE', format: SECRET_FORMATS.hex64 },
			{ group: 'generated', key: 'NEXTAUTH_SECRET', format: SECRET_FORMATS.base64url32 },
			{ group: 'generated', key: 'JWT_SECRET', format: SECRET_FORMATS.base64url32 }
		]);
	});

	it('asks the user for credentials by name, with no value to start from', () => {
		const { rows } = classifyEnvExample(LARAVEL, context);
		expect(find(rows, 'MAIL_PASSWORD')).toEqual({
			group: 'needs-input',
			key: 'MAIL_PASSWORD',
			hint: null
		});
		expect(find(rows, 'AWS_SECRET_ACCESS_KEY')).toMatchObject({ group: 'needs-input', hint: null });
	});

	it('shows a plain example as a hint, but never one that looks like a secret', () => {
		const { rows } = classifyEnvExample(
			[
				entry('STRIPE_SECRET', 'sk_test_abcdefghijklmnop'),
				entry('MAILGUN_SECRET', 'your-mailgun-secret'),
				entry('GITHUB_URL', 'ghp_abcdefghijklmnopqrstuvwxyz0123456789'),
				entry('BROKER', 'postgres://kopi:rahasia@db.local/kopi')
			],
			context
		);
		expect(find(rows, 'STRIPE_SECRET')).toMatchObject({ group: 'needs-input', hint: null });
		expect(find(rows, 'MAILGUN_SECRET')).toMatchObject({ hint: 'your-mailgun-secret' });
		// A token-shaped value moves an innocent name to "Perlu kamu isi", without the value.
		expect(find(rows, 'GITHUB_URL')).toEqual({
			group: 'needs-input',
			key: 'GITHUB_URL',
			hint: null
		});
		expect(find(rows, 'BROKER')).toEqual({ group: 'needs-input', key: 'BROKER', hint: null });
		for (const row of rows) expect(JSON.stringify(row)).not.toMatch(/sk_test|ghp_|rahasia/);
	});

	it('prefills the rest from the file, on only when there is a value', () => {
		const { rows } = classifyEnvExample(LARAVEL, context);
		expect(find(rows, 'APP_NAME')).toEqual({
			group: 'example',
			key: 'APP_NAME',
			value: 'Laravel',
			included: true,
			note: null
		});
		expect(find(rows, 'SESSION_DOMAIN')).toMatchObject({ value: '', included: false });
	});
});

describe('classifyEnvExample, null and empty values', () => {
	it.each([null, '', '   ', 'null', 'NULL', '""', "''"])('reads %j as empty', (value) => {
		expect(normalizeExampleValue(value)).toBe('');
	});

	it('keeps a value that only contains the word', () => {
		expect(normalizeExampleValue('nullable')).toBe('nullable');
	});

	it('hides a Laravel-style null hint for a credential', () => {
		const { rows } = classifyEnvExample([entry('REDIS_PASSWORD', 'null')], context);
		expect(rows[0]).toEqual({ group: 'needs-input', key: 'REDIS_PASSWORD', hint: null });
	});
});

describe('classifyEnvExample, production overrides and the project address', () => {
	it('suggests production values, saying what they replaced', () => {
		const { rows } = classifyEnvExample(
			[entry('APP_ENV', 'local'), entry('APP_DEBUG', 'true'), entry('NODE_ENV', null)],
			context
		);
		expect(rows).toEqual([
			{
				group: 'example',
				key: 'APP_ENV',
				value: 'production',
				included: true,
				note: { kind: 'production-override', from: 'local' }
			},
			{
				group: 'example',
				key: 'APP_DEBUG',
				value: 'false',
				included: true,
				note: { kind: 'production-override', from: 'true' }
			},
			{
				group: 'example',
				key: 'NODE_ENV',
				value: 'production',
				included: true,
				note: { kind: 'production-override', from: null }
			}
		]);
	});

	it('does not mark a value that is already the production one', () => {
		const { rows } = classifyEnvExample([entry('APP_ENV', 'production')], context);
		expect(rows[0]).toMatchObject({ value: 'production', note: null });
	});

	it('prefills APP_URL, NEXTAUTH_URL, and AUTH_URL with the public URL, as editable rows', () => {
		const { rows } = classifyEnvExample(
			[entry('APP_URL', 'http://localhost'), entry('NEXTAUTH_URL', null), entry('AUTH_URL', '')],
			context
		);
		for (const row of rows) {
			expect(row).toMatchObject({
				group: 'example',
				value: 'https://toko-kopi.sakala.app',
				included: true,
				note: { kind: 'project-url' }
			});
		}
	});

	it('falls back to the file when the address is not known yet', () => {
		const { rows } = classifyEnvExample([entry('APP_URL', 'http://localhost')], {
			...context,
			publicUrl: null
		});
		expect(rows[0]).toMatchObject({ value: 'http://localhost', note: null });
	});

	it('leaves a value that refers to another variable empty, and says why', () => {
		const { rows } = classifyEnvExample([entry('MAIL_FROM_NAME', '${APP_NAME}')], context);
		expect(rows[0]).toEqual({
			group: 'example',
			key: 'MAIL_FROM_NAME',
			value: '',
			included: false,
			note: { kind: 'variable-reference', reference: '${APP_NAME}' }
		});
	});
});

describe('classifyEnvExample, with and without a database', () => {
	it('fills the connection variables from the database, and turns DB_URL off with a note', () => {
		const { rows } = classifyEnvExample(LARAVEL, { ...context, databaseProvided: true });
		expect(find(rows, 'DB_CONNECTION')).toEqual({
			group: 'platform',
			key: 'DB_CONNECTION',
			source: 'database'
		});
		expect(find(rows, 'DB_HOST')).toMatchObject({ group: 'platform', source: 'database' });
		expect(find(rows, 'DB_URL')).toEqual({
			group: 'example',
			key: 'DB_URL',
			value: '',
			included: false,
			note: { kind: 'database-url-override' }
		});
	});

	it('keeps an example DB_URL value but still off', () => {
		const { rows } = classifyEnvExample([entry('DB_URL', 'postgres://localhost/app')], {
			...context,
			databaseProvided: true
		});
		expect(rows[0]).toMatchObject({ value: 'postgres://localhost/app', included: false });
	});

	it('treats the same keys as ordinary rows without a database', () => {
		const { rows } = classifyEnvExample(LARAVEL, context);
		expect(find(rows, 'DB_CONNECTION')).toMatchObject({ group: 'example', value: 'sqlite' });
		expect(find(rows, 'DB_HOST')).toMatchObject({ group: 'example', value: '127.0.0.1' });
		expect(find(rows, 'DB_URL')).toMatchObject({ group: 'example', note: null, included: false });
	});

	it('still asks for DB_PASSWORD without a database', () => {
		const { rows } = classifyEnvExample([entry('DB_PASSWORD', 'secret')], context);
		expect(rows[0]).toMatchObject({ group: 'needs-input' });
	});
});

describe('classifyEnvExample, keys that already exist', () => {
	it('skips them and lists them once', () => {
		const set = classifyEnvExample(LARAVEL, {
			...context,
			existingKeys: ['APP_KEY', 'APP_NAME', 'UNRELATED']
		});
		expect(set.alreadySet).toEqual(['APP_NAME', 'APP_KEY']);
		expect(set.rows.map((row) => row.key)).not.toContain('APP_KEY');
	});

	it('keeps PORT as Sakala’s even when a variable of that name exists', () => {
		const set = classifyEnvExample([entry('PORT', '3000')], { ...context, existingKeys: ['PORT'] });
		expect(set.alreadySet).toEqual([]);
		expect(set.rows[0]).toMatchObject({ group: 'platform' });
	});

	it('reads a repeated key once, the first time', () => {
		const set = classifyEnvExample([entry('A', '1'), entry('A', '2')], context);
		expect(set.rows).toHaveLength(1);
		expect(set.rows[0]).toMatchObject({ value: '1' });
	});
});

describe('hasStorableSuggestions', () => {
	it('is false when Sakala fills everything itself', () => {
		expect(hasStorableSuggestions(classifyEnvExample([entry('PORT', '3000')], context))).toBe(
			false
		);
	});

	it('is false when every key is set already', () => {
		const set = classifyEnvExample([entry('APP_NAME', 'x')], {
			...context,
			existingKeys: ['APP_NAME']
		});
		expect(hasStorableSuggestions(set)).toBe(false);
	});

	it('is true with one row the user can keep', () => {
		expect(hasStorableSuggestions(classifyEnvExample([entry('APP_NAME', 'x')], context))).toBe(
			true
		);
	});
});

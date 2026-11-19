import { describe, expect, it, vi } from 'vitest';
import { classifyEnvExample, type EnvSuggestionContext } from './classify-env-example';
import {
	editDraft,
	emptyNeedsInputCount,
	onePerKey,
	planSuggestionImport,
	suggestedEnvVars,
	syncSuggestionDraft
} from './suggestion-draft';

const context: EnvSuggestionContext = {
	publicUrl: 'https://kopi.sakala.app',
	databaseProvided: false,
	existingKeys: []
};

const entries = [
	{ key: 'APP_NAME', example_value: 'Kopi' },
	{ key: 'APP_KEY', example_value: null },
	{ key: 'MAIL_PASSWORD', example_value: null },
	{ key: 'SESSION_DOMAIN', example_value: 'null' },
	{ key: 'DB_HOST', example_value: '127.0.0.1' },
	{ key: 'PORT', example_value: '8000' }
];

function setup(overrides: Partial<EnvSuggestionContext> = {}) {
	const generate = vi.fn(() => 'generated-value');
	const rows = classifyEnvExample(entries, { ...context, ...overrides }).rows;
	return { rows, generate, draft: syncSuggestionDraft({}, rows, generate) };
}

describe('syncSuggestionDraft', () => {
	it('starts each row from its defaults and makes each secret once', () => {
		const { draft, generate } = setup();
		expect(draft.APP_KEY).toMatchObject({ included: true, value: 'generated-value' });
		expect(draft.MAIL_PASSWORD).toMatchObject({ included: true, value: '' });
		expect(draft.SESSION_DOMAIN).toMatchObject({ included: false, value: '' });
		expect(draft.PORT).toBeUndefined();
		expect(generate).toHaveBeenCalledTimes(1);
	});

	it('returns the same draft when nothing changed, and never regenerates a key', () => {
		const { rows, draft, generate } = setup();
		expect(syncSuggestionDraft(draft, rows, generate)).toBe(draft);
		expect(generate).toHaveBeenCalledTimes(1);
	});

	it('keeps what the user typed when the database choice reclassifies the row', () => {
		const { draft, generate } = setup();
		const edited = editDraft(draft, 'DB_HOST', { value: 'db.example' });
		const withDatabase = classifyEnvExample(entries, { ...context, databaseProvided: true }).rows;
		const synced = syncSuggestionDraft(edited, withDatabase, generate);
		const without = classifyEnvExample(entries, context).rows;
		expect(syncSuggestionDraft(synced, without, generate).DB_HOST.value).toBe('db.example');
	});
});

describe('onePerKey', () => {
	it('makes a value once per key', () => {
		const generate = vi.fn((format: string) => `${format}-${generate.mock.calls.length}`);
		const once = onePerKey(generate);
		expect(once('hex-64', 'SECRET_KEY_BASE')).toBe(once('hex-64', 'SECRET_KEY_BASE'));
		expect(once('base64url-32', 'JWT_SECRET')).not.toBe(once('hex-64', 'SECRET_KEY_BASE'));
		expect(generate).toHaveBeenCalledTimes(2);
	});
});

describe('editDraft', () => {
	it('turns a row on when the user types into it', () => {
		const { draft } = setup();
		expect(editDraft(draft, 'SESSION_DOMAIN', { value: '.kopi.app' }).SESSION_DOMAIN).toMatchObject(
			{
				included: true,
				touched: true
			}
		);
	});

	it('leaves the box alone when the value is emptied', () => {
		const { draft } = setup();
		expect(editDraft(draft, 'APP_NAME', { value: '' }).APP_NAME.included).toBe(true);
	});

	it('ignores a key it does not hold', () => {
		const { draft } = setup();
		expect(editDraft(draft, 'NOPE', { value: 'x' })).toBe(draft);
	});
});

describe('suggestedEnvVars', () => {
	it('stores kept rows with a value, secrets as secrets, and skips an empty input', () => {
		const { rows, draft } = setup();
		expect(suggestedEnvVars(rows, draft)).toEqual([
			{ key: 'APP_NAME', value: 'Kopi', isSecret: false },
			{ key: 'APP_KEY', value: 'generated-value', isSecret: true },
			{ key: 'DB_HOST', value: '127.0.0.1', isSecret: false }
		]);
	});

	it('stores a filled needs-input row as a secret, and drops an excluded row', () => {
		const { rows, draft } = setup();
		let next = editDraft(draft, 'MAIL_PASSWORD', { value: 'hunter2' });
		next = editDraft(next, 'APP_NAME', { included: false });
		const saved = suggestedEnvVars(rows, next);
		expect(saved).toContainEqual({ key: 'MAIL_PASSWORD', value: 'hunter2', isSecret: true });
		expect(saved.map((env) => env.key)).not.toContain('APP_NAME');
	});

	it('makes an example row secret when what the user typed looks like a credential', () => {
		const { rows, draft } = setup();
		const next = editDraft(draft, 'DB_HOST', { value: 'postgres://u:p@db/kopi' });
		expect(suggestedEnvVars(rows, next)).toContainEqual({
			key: 'DB_HOST',
			value: 'postgres://u:p@db/kopi',
			isSecret: true
		});
	});

	it('never stores what Sakala fills itself', () => {
		const { draft, generate } = setup();
		const rows = classifyEnvExample(entries, { ...context, databaseProvided: true }).rows;
		const keys = suggestedEnvVars(rows, syncSuggestionDraft(draft, rows, generate)).map(
			(env) => env.key
		);
		expect(keys).not.toContain('PORT');
		expect(keys).not.toContain('DB_HOST');
	});
});

describe('emptyNeedsInputCount', () => {
	it('counts the inputs still empty', () => {
		const { rows, draft } = setup();
		expect(emptyNeedsInputCount(rows, draft)).toBe(1);
		expect(emptyNeedsInputCount(rows, editDraft(draft, 'MAIL_PASSWORD', { value: 'x' }))).toBe(0);
	});
});

describe('planSuggestionImport', () => {
	it('adds new keys and follows Lewati for existing ones', () => {
		const { rows, draft } = setup();
		const plan = planSuggestionImport(rows, draft, ['APP_NAME'], 'skip');
		expect(plan.toAdd.map((env) => env.key)).toEqual(['APP_KEY', 'DB_HOST']);
		expect(plan.kept).toEqual(['APP_NAME']);
	});

	it('overwrites with Timpa, but never replaces a live generated key', () => {
		const { rows, draft } = setup();
		const plan = planSuggestionImport(rows, draft, ['APP_NAME', 'APP_KEY'], 'overwrite');
		expect(plan.toOverwrite.map((env) => env.key)).toEqual(['APP_NAME']);
		expect(plan.kept).toEqual(['APP_KEY']);
		expect(plan.toAdd.find((env) => env.key === 'APP_KEY')).toBeUndefined();
	});
});

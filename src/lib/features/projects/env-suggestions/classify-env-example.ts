import { keyLooksLikeSecret, valueLooksLikeSecret } from '../env-import/looks-like-secret';
import type { SecretFormat } from '../secret-generation';
import type { EnvExampleEntry } from '../type';
import {
	DATABASE_PROVIDED_KEYS,
	DATABASE_URL_OVERRIDE_KEY,
	EMPTY_EXAMPLE_VALUES,
	GENERATED_SECRET_FORMATS,
	LOG_LEVEL_KEY,
	PORT_KEY,
	PRODUCTION_LOG_LEVEL,
	PRODUCTION_OVERRIDES,
	PROJECT_URL_KEYS,
	VARIABLE_REFERENCE,
	VERBOSE_LOG_LEVELS
} from './rules';

/**
 * Turns the entries of a repository's `.env.example` into suggestions for a deployed app.
 *
 * The rules, first match wins (names are in rules.ts):
 *
 * 1. Already set in the project (or the wizard's draft): not suggested, only listed in
 *    `alreadySet`, so an existing value is never changed from here.
 * 2. `platform` (Diisi Sakala): PORT always; with a database, its connection variables. Never
 *    stored: Sakala gives them to every deployment. With a database, DB_URL becomes an example row
 *    that is off by default, because Laravel reads it before DB_HOST.
 * 3. Project URL keys (APP_URL, NEXTAUTH_URL, AUTH_URL): prefilled with the project's public URL,
 *    as normal editable variables.
 * 4. `generated` (Dibuatkan): random signing keys the browser makes; stored as secrets.
 * 5. `needs-input` (Perlu kamu isi): a name that looks like a credential, or an example value that
 *    does. The input starts empty; the example shows as a hint only when it is a real value that
 *    does not itself look like a secret. Empty means skipped, never a blocker.
 * 6. `example` (Dari .env.example): the example value, on by default only when it is not empty
 *    (`null` is empty). APP_ENV, NODE_ENV, and APP_DEBUG get production values, and a verbose
 *    LOG_LEVEL (debug, trace) becomes info, each marked as changed.
 *    A value that refers to another variable (`${APP_NAME}`) is left empty and off.
 *
 * An example value that looks like a secret is never used as a value or a hint.
 */

export const SUGGESTION_GROUPS = {
	needsInput: 'needs-input',
	generated: 'generated',
	example: 'example',
	platform: 'platform'
} as const;

export type EnvSuggestionGroup = (typeof SUGGESTION_GROUPS)[keyof typeof SUGGESTION_GROUPS];

/** Why Sakala fills a variable itself. */
export type PlatformSource = 'port' | 'database';

/** Why an example row reads differently from the file, for the hint under it. */
export type ExampleNote =
	| { kind: 'production-override'; from: string | null }
	| { kind: 'project-url' }
	| { kind: 'database-url-override' }
	| { kind: 'variable-reference'; reference: string };

export type PlatformSuggestion = {
	group: typeof SUGGESTION_GROUPS.platform;
	key: string;
	source: PlatformSource;
};

export type GeneratedSuggestion = {
	group: typeof SUGGESTION_GROUPS.generated;
	key: string;
	format: SecretFormat;
};

export type NeedsInputSuggestion = {
	group: typeof SUGGESTION_GROUPS.needsInput;
	key: string;
	/** The example value, safe to show as "Contoh: …"; `null` when there is none worth showing. */
	hint: string | null;
};

export type ExampleSuggestion = {
	group: typeof SUGGESTION_GROUPS.example;
	key: string;
	value: string;
	/** On by default: a value worth sending. */
	included: boolean;
	note: ExampleNote | null;
};

export type EnvSuggestion =
	PlatformSuggestion | GeneratedSuggestion | NeedsInputSuggestion | ExampleSuggestion;

/** Rows that end up stored when the user keeps them: everything but `platform`. */
export type StorableSuggestion = Exclude<EnvSuggestion, PlatformSuggestion>;

export type EnvSuggestionContext = {
	/** The project's address, `https://…`; `null` while unknown. */
	publicUrl: string | null;
	/** The project gets a Sakala database (new or existing), which fills the DB variables. */
	databaseProvided: boolean;
	/** Keys the project or the wizard's draft already has. */
	existingKeys: readonly string[];
};

export type EnvSuggestionSet = {
	rows: EnvSuggestion[];
	/** Keys from the file that are already set, left as they are. */
	alreadySet: string[];
};

/** `null`, `""`, and blank are "no value" in an example file. */
export function normalizeExampleValue(value: string | null): string {
	if (value === null) return '';
	const trimmed = value.trim();
	return trimmed === '' || EMPTY_EXAMPLE_VALUES.includes(trimmed.toLowerCase()) ? '' : value;
}

/** The value a deployed app should run with instead of the example's, if any. */
function productionValue(key: string, exampleValue: string): string | undefined {
	const fixed = PRODUCTION_OVERRIDES[key];
	if (fixed !== undefined) return fixed;
	if (key !== LOG_LEVEL_KEY || !VERBOSE_LOG_LEVELS.includes(exampleValue.toLowerCase())) {
		return undefined;
	}
	return exampleValue === exampleValue.toUpperCase()
		? PRODUCTION_LOG_LEVEL.toUpperCase()
		: PRODUCTION_LOG_LEVEL;
}

function classifyEntry(
	key: string,
	exampleValue: string,
	context: EnvSuggestionContext
): EnvSuggestion {
	if (key === PORT_KEY) return { group: SUGGESTION_GROUPS.platform, key, source: 'port' };

	if (context.databaseProvided) {
		if (DATABASE_PROVIDED_KEYS.includes(key)) {
			return { group: SUGGESTION_GROUPS.platform, key, source: 'database' };
		}
		if (key === DATABASE_URL_OVERRIDE_KEY && !valueLooksLikeSecret(exampleValue)) {
			return {
				group: SUGGESTION_GROUPS.example,
				key,
				value: exampleValue,
				included: false,
				note: { kind: 'database-url-override' }
			};
		}
	}

	if (PROJECT_URL_KEYS.includes(key) && context.publicUrl) {
		return {
			group: SUGGESTION_GROUPS.example,
			key,
			value: context.publicUrl,
			included: true,
			note: { kind: 'project-url' }
		};
	}

	const format = GENERATED_SECRET_FORMATS[key];
	if (format) return { group: SUGGESTION_GROUPS.generated, key, format };

	const valueIsSecret = exampleValue !== '' && valueLooksLikeSecret(exampleValue);
	if (keyLooksLikeSecret(key) || valueIsSecret) {
		return {
			group: SUGGESTION_GROUPS.needsInput,
			key,
			hint: exampleValue !== '' && !valueIsSecret ? exampleValue : null
		};
	}

	const override = productionValue(key, exampleValue);
	if (override !== undefined) {
		return {
			group: SUGGESTION_GROUPS.example,
			key,
			value: override,
			included: true,
			note:
				exampleValue === override
					? null
					: { kind: 'production-override', from: exampleValue === '' ? null : exampleValue }
		};
	}

	const reference = exampleValue.match(VARIABLE_REFERENCE);
	if (reference) {
		return {
			group: SUGGESTION_GROUPS.example,
			key,
			value: '',
			included: false,
			note: { kind: 'variable-reference', reference: reference[0] }
		};
	}

	return {
		group: SUGGESTION_GROUPS.example,
		key,
		value: exampleValue,
		included: exampleValue !== '',
		note: null
	};
}

export function classifyEnvExample(
	entries: readonly EnvExampleEntry[],
	context: EnvSuggestionContext
): EnvSuggestionSet {
	const existing = new Set(context.existingKeys);
	const seen = new Set<string>();
	const rows: EnvSuggestion[] = [];
	const alreadySet: string[] = [];

	for (const entry of entries) {
		if (seen.has(entry.key)) continue;
		seen.add(entry.key);
		// PORT is Sakala's in every case, even if a variable of that name exists.
		if (existing.has(entry.key) && entry.key !== PORT_KEY) {
			alreadySet.push(entry.key);
			continue;
		}
		rows.push(classifyEntry(entry.key, normalizeExampleValue(entry.example_value), context));
	}

	return { rows, alreadySet };
}

export function isStorable(row: EnvSuggestion): row is StorableSuggestion {
	return row.group !== SUGGESTION_GROUPS.platform;
}

/** Whether the file asks anything of the user: a row beyond what Sakala fills in itself. */
export function hasStorableSuggestions(set: EnvSuggestionSet): boolean {
	return set.rows.some(isStorable);
}

export function rowsInGroup<Group extends EnvSuggestionGroup>(
	rows: readonly EnvSuggestion[],
	group: Group
): Extract<EnvSuggestion, { group: Group }>[] {
	return rows.filter((row): row is Extract<EnvSuggestion, { group: Group }> => row.group === group);
}

import { looksLikeSecret } from '../env-import/looks-like-secret';
import type {
	ExistingKeyStrategy,
	EnvImportPlan,
	PlannedEnvVar
} from '../env-import/plan-env-import';
import type { SecretFormat } from '../secret-generation';
import {
	isStorable,
	SUGGESTION_GROUPS,
	type EnvSuggestion,
	type StorableSuggestion
} from './classify-env-example';

/**
 * What the user made of each suggestion: kept or not, and the value. Keyed by variable name, so
 * a row that changes group when the database choice changes keeps what the user typed.
 */
export type DraftEntry = {
	included: boolean;
	value: string;
	/** The user changed it; a later reclassification no longer resets it. */
	touched: boolean;
	/** The group the defaults came from, to notice a reclassification. */
	group: StorableSuggestion['group'];
};

export type SuggestionDraft = Readonly<Record<string, DraftEntry>>;

/** Makes the value of a generated row; the caller keeps one per key so a value never changes. */
export type GenerateSecret = (format: SecretFormat, key: string) => string;

/**
 * A generator that makes one value per key for as long as the caller keeps it, so recomputing the
 * draft (a re-render, a changed database choice) never changes a key already made.
 */
export function onePerKey(generate: (format: SecretFormat) => string): GenerateSecret {
	const made = new Map<string, string>();
	return (format, key) => {
		let value = made.get(key);
		if (value === undefined) {
			value = generate(format);
			made.set(key, value);
		}
		return value;
	};
}

/** A variable as it is stored: what saveEnvVars and the import plan take. */
export type SuggestedEnvVar = { key: string; value: string; isSecret: boolean };

function defaults(row: StorableSuggestion, generate: GenerateSecret, previous?: DraftEntry) {
	switch (row.group) {
		case SUGGESTION_GROUPS.generated:
			// A key made once stays the same: regenerating would change a value the user may have seen.
			return {
				included: true,
				value:
					previous?.group === SUGGESTION_GROUPS.generated
						? previous.value
						: generate(row.format, row.key)
			};
		case SUGGESTION_GROUPS.needsInput:
			return { included: true, value: '' };
		case SUGGESTION_GROUPS.example:
			return { included: row.included, value: row.value };
	}
}

/**
 * The draft for the current rows: a new row gets its defaults; a row the user has not touched
 * follows its new defaults when its group or default changed; a touched row stays as typed.
 */
export function syncSuggestionDraft(
	draft: SuggestionDraft,
	rows: readonly EnvSuggestion[],
	generate: GenerateSecret
): SuggestionDraft {
	const next: Record<string, DraftEntry> = { ...draft };
	let changed = false;
	for (const row of rows) {
		if (!isStorable(row)) continue;
		const previous = draft[row.key];
		if (previous?.touched) continue;
		const fresh = defaults(row, generate, previous);
		if (
			previous?.group === row.group &&
			previous.included === fresh.included &&
			previous.value === fresh.value
		) {
			continue;
		}
		next[row.key] = { ...fresh, touched: false, group: row.group };
		changed = true;
	}
	// The same object when nothing moved, so a reactive caller does not loop.
	return changed ? next : draft;
}

/** A change the user made to one row. */
export function editDraft(
	draft: SuggestionDraft,
	key: string,
	change: Partial<Pick<DraftEntry, 'included' | 'value'>>
): SuggestionDraft {
	const entry = draft[key];
	if (!entry) return draft;
	const value = change.value ?? entry.value;
	// Typing into a row that was off means the user wants it; emptying it leaves the box alone.
	const included =
		change.included ?? (change.value !== undefined && value.trim() !== '' ? true : entry.included);
	return { ...draft, [key]: { ...entry, value, included, touched: true } };
}

function isSecretRow(row: StorableSuggestion, value: string): boolean {
	return row.group !== SUGGESTION_GROUPS.example || looksLikeSecret(row.key, value);
}

/**
 * The variables to store, in row order: kept rows with a value. An empty "Perlu kamu isi" row is
 * skipped rather than blocking the deploy. Generated and needs-input rows are always secrets; an
 * example row becomes one when what it holds looks like a credential.
 */
export function suggestedEnvVars(
	rows: readonly EnvSuggestion[],
	draft: SuggestionDraft
): SuggestedEnvVar[] {
	const result: SuggestedEnvVar[] = [];
	for (const row of rows) {
		if (!isStorable(row)) continue;
		const entry = draft[row.key];
		if (!entry?.included) continue;
		const value = entry.value.trim();
		if (!value) continue;
		result.push({ key: row.key, value, isSecret: isSecretRow(row, value) });
	}
	return result;
}

/** How many rows wait for the user: the "Perlu kamu isi" inputs still empty. */
export function emptyNeedsInputCount(
	rows: readonly EnvSuggestion[],
	draft: SuggestionDraft
): number {
	return rows.filter(
		(row) =>
			row.group === SUGGESTION_GROUPS.needsInput &&
			draft[row.key]?.included !== false &&
			!draft[row.key]?.value.trim()
	).length;
}

/**
 * The same choice as a pasted .env on the Variabel tab, so it saves through the same code. A key
 * the project has follows the panel's Lewati/Timpa choice, except a generated key: replacing a
 * live APP_KEY or session secret would log everyone out and leave encrypted data unreadable.
 */
export function planSuggestionImport(
	rows: readonly EnvSuggestion[],
	draft: SuggestionDraft,
	existingKeys: readonly string[],
	strategy: ExistingKeyStrategy
): EnvImportPlan {
	const existing = new Set(existingKeys);
	const generated = new Set(
		rows.filter((row) => row.group === SUGGESTION_GROUPS.generated).map((row) => row.key)
	);
	const plan: EnvImportPlan = { toAdd: [], toOverwrite: [], kept: [] };

	for (const env of suggestedEnvVars(rows, draft)) {
		const planned: PlannedEnvVar = { ...env, looksSecret: env.isSecret };
		if (!existing.has(env.key)) plan.toAdd.push(planned);
		else if (strategy === 'overwrite' && !generated.has(env.key)) plan.toOverwrite.push(planned);
		else plan.kept.push(env.key);
	}

	return plan;
}

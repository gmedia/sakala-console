import { looksLikeSecret } from './looks-like-secret';
import type { ParsedEnvEntry } from './parse-env-text';

/** What to do with a pasted key that the project or the draft list already has. */
export type ExistingKeyStrategy = 'skip' | 'overwrite';

export type PlannedEnvVar = ParsedEnvEntry & { isSecret: boolean; looksSecret: boolean };

export type EnvImportPlan = {
	toAdd: PlannedEnvVar[];
	toOverwrite: PlannedEnvVar[];
	/** Existing keys left as they are. */
	kept: string[];
};

/**
 * Splits pasted entries into new and existing keys. An existing key is never changed unless the
 * user picked "Timpa"; with "Lewati" it keeps the value it has.
 */
export function planEnvImport(
	entries: readonly ParsedEnvEntry[],
	existingKeys: readonly string[],
	{ strategy, storeAllAsSecret }: { strategy: ExistingKeyStrategy; storeAllAsSecret: boolean }
): EnvImportPlan {
	const existing = new Set(existingKeys);
	const plan: EnvImportPlan = { toAdd: [], toOverwrite: [], kept: [] };

	for (const entry of entries) {
		const looksSecret = looksLikeSecret(entry.key, entry.value);
		const planned = { ...entry, looksSecret, isSecret: storeAllAsSecret || looksSecret };
		if (!existing.has(entry.key)) plan.toAdd.push(planned);
		else if (strategy === 'overwrite') plan.toOverwrite.push(planned);
		else plan.kept.push(entry.key);
	}

	return plan;
}

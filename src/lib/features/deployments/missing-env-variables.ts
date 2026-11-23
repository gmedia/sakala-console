import {
	classifyEnvExample,
	isStorable
} from '$lib/features/projects/env-suggestions/classify-env-example';
import type { ProjectEnvExample } from '$lib/features/projects/type';

/** A sentence stays readable with three names; the rest are counted (Miller's Law). */
export const MAX_KEYS_IN_SENTENCE = 3;

/** The failure stage whose screen names the variables: the app started and did not answer. */
export const MISSING_ENV_STAGE = 'health_checking';

export const MISSING_ENV_COPY = {
	action: 'Isi di tab Variabel',
	sentence: (file: string, count: string, list: string) =>
		`${file} di repository-mu menyebut ${count} variabel yang belum ada di proyek ini: ${list}. Aplikasi yang membacanya saat mulai bisa gagal menjawab pengecekan Sakala.`,
	rest: (count: string) => `${count} lainnya`
} as const;

export type MissingEnvVariablesNote = { sentence: string; action: string; href: string };

const listFormat = new Intl.ListFormat('id', { type: 'conjunction' });
const countFormat = new Intl.NumberFormat('id-ID');

/**
 * The keys of `.env.example` the project has not set, leaving out what Sakala fills itself (PORT,
 * and the database variables when a database is attached), with the rules of the Variabel tab's
 * suggestions.
 */
export function missingEnvExampleKeys(
	example: Pick<ProjectEnvExample, 'entries'>,
	{ existingKeys, databaseProvided }: { existingKeys: readonly string[]; databaseProvided: boolean }
): string[] {
	return classifyEnvExample(example.entries, { existingKeys, databaseProvided, publicUrl: null })
		.rows.filter(isStorable)
		.map((row) => row.key);
}

/** The note under a failure at "Mengecek aplikasi", or `null` when nothing is missing. */
export function missingEnvVariablesNote(
	example: Pick<ProjectEnvExample, 'entries' | 'file'>,
	context: { existingKeys: readonly string[]; databaseProvided: boolean; href: string }
): MissingEnvVariablesNote | null {
	const keys = missingEnvExampleKeys(example, context);
	if (keys.length === 0) return null;

	const shown = keys.slice(0, MAX_KEYS_IN_SENTENCE);
	const rest = keys.length - shown.length;
	const items = rest > 0 ? [...shown, MISSING_ENV_COPY.rest(countFormat.format(rest))] : shown;
	return {
		sentence: MISSING_ENV_COPY.sentence(
			example.file,
			countFormat.format(keys.length),
			listFormat.format(items)
		),
		action: MISSING_ENV_COPY.action,
		href: context.href
	};
}

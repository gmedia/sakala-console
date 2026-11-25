import type { ProjectValkey } from '$lib/features/projects/type';
import { LARAVEL_VALKEY_SUGGESTIONS, VALKEY_VARIABLES, type ValkeySuggestion } from './variables';

export type ValkeyVariableRow = {
	name: string;
	/** The project sets a variable with this name itself, and its value wins. */
	overridden: boolean;
};

/**
 * The store's variables, in the API's order, each marked when a project variable of the same name
 * takes its place. A name only a newer API sends still shows last.
 */
export function valkeyVariableRows(valkey: ProjectValkey): ValkeyVariableRow[] {
	const injected = new Set(valkey.variables);
	const overridden = new Set(valkey.overridden_variables);
	const known: readonly string[] = VALKEY_VARIABLES;
	const extra = [...injected, ...overridden].filter((name) => !known.includes(name));
	return [...known, ...new Set(extra)]
		.filter((name) => injected.has(name) || overridden.has(name))
		.map((name) => ({ name, overridden: overridden.has(name) }));
}

/** The project's own variable names that override a store variable, for the list above. */
export function overriddenValkeyNames(valkeys: readonly ProjectValkey[] | undefined): Set<string> {
	return new Set(valkeys?.flatMap((valkey) => valkey.overridden_variables) ?? []);
}

export type LaravelSuggestionState = {
	/** Missing from the project: the Console can add them in one step. */
	missing: ValkeySuggestion[];
	/** Set to another value, for example `QUEUE_CONNECTION=database`: the user decides. */
	different: (ValkeySuggestion & { current: string | null })[];
};

/**
 * Where the project stands on the Laravel variables the Console suggests. `values` holds the
 * project's variables, with `null` for a secret whose value the list does not show.
 */
export function laravelSuggestionState(
	values: ReadonlyMap<string, string | null>
): LaravelSuggestionState {
	const missing: ValkeySuggestion[] = [];
	const different: LaravelSuggestionState['different'] = [];
	for (const suggestion of LARAVEL_VALKEY_SUGGESTIONS) {
		if (!values.has(suggestion.key)) missing.push(suggestion);
		else if (values.get(suggestion.key) !== suggestion.value) {
			different.push({ ...suggestion, current: values.get(suggestion.key) ?? null });
		}
	}
	return { missing, different };
}

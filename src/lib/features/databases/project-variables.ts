import type { ProjectDatabase } from '$lib/features/projects/type';
import { DATABASE_VARIABLES } from './presentation';

export type DatabaseVariableRow = {
	name: string;
	/** The project sets a variable with this name itself, and its value wins. */
	overridden: boolean;
};

/**
 * The connection variables of the attached database, in the API's documented order, each marked
 * when a project variable of the same name takes its place. A name only a newer API sends still
 * shows, after the known ones.
 */
export function databaseVariableRows(database: ProjectDatabase): DatabaseVariableRow[] {
	const injected = new Set(database.variables);
	const overridden = new Set(database.overridden_variables);
	const known: readonly string[] = DATABASE_VARIABLES;
	const extra = [...injected, ...overridden].filter((name) => !known.includes(name));
	return [...known, ...new Set(extra)]
		.filter((name) => injected.has(name) || overridden.has(name))
		.map((name) => ({ name, overridden: overridden.has(name) }));
}

/** The project's own variable names that override a database variable, for the list above. */
export function overriddenNames(databases: readonly ProjectDatabase[] | undefined): Set<string> {
	return new Set(databases?.flatMap((database) => database.overridden_variables) ?? []);
}

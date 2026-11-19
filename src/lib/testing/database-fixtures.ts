import { apiErrorFromResponse, type ApiError } from '$lib/api/errors';
import type { CapturedResponse } from './workspace-fixtures';

/**
 * Responses captured from sakala-api for the database endpoints (tests/fixtures/databases), with
 * Laravel's debug fields dropped. The passwords in them are random test values.
 */
const fixtures = import.meta.glob<CapturedResponse>('../../../tests/fixtures/databases/*.json', {
	eager: true,
	import: 'default'
});

export function getDatabaseFixture(name: string): CapturedResponse {
	const fixture = fixtures[`../../../tests/fixtures/databases/${name}.json`];
	if (!fixture) throw new Error(`No captured response named ${name}`);
	return structuredClone(fixture);
}

export function databaseFixtureNames(): string[] {
	return Object.keys(fixtures).map((path) => path.replace(/^.*\/(.+)\.json$/, '$1'));
}

/** The ApiError the client builds from a captured error response, extra fields included. */
export function errorFromDatabaseFixture(name: string): ApiError {
	const { status, body } = getDatabaseFixture(name);
	const { message, code, errors, ...details } = (body ?? {}) as {
		message?: unknown;
		code?: unknown;
		errors?: Record<string, string[]>;
	} & Record<string, unknown>;
	return apiErrorFromResponse(status, { apiMessage: message, code, errors, details });
}

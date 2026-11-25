import { apiErrorFromResponse, type ApiError } from '$lib/api/errors';
import type { CapturedResponse } from './workspace-fixtures';

/**
 * Responses captured from sakala-api for the Valkey endpoints (tests/fixtures/valkeys), from
 * gmedia/sakala-api main fc93ff9 (#211), with Laravel's debug fields dropped. The passwords in
 * them are random test values.
 */
const fixtures = import.meta.glob<CapturedResponse>('../../../tests/fixtures/valkeys/*.json', {
	eager: true,
	import: 'default'
});

export function getValkeyFixture(name: string): CapturedResponse {
	const fixture = fixtures[`../../../tests/fixtures/valkeys/${name}.json`];
	if (!fixture) throw new Error(`No captured response named ${name}`);
	return structuredClone(fixture);
}

export function valkeyFixtureNames(): string[] {
	return Object.keys(fixtures).map((path) => path.replace(/^.*\/(.+)\.json$/, '$1'));
}

/** The ApiError the client builds from a captured error response, extra fields included. */
export function errorFromValkeyFixture(name: string): ApiError {
	const { status, body } = getValkeyFixture(name);
	const { message, code, errors, ...details } = (body ?? {}) as {
		message?: unknown;
		code?: unknown;
		errors?: Record<string, string[]>;
	} & Record<string, unknown>;
	return apiErrorFromResponse(status, { apiMessage: message, code, errors, details });
}

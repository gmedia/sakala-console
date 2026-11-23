import { apiErrorFromResponse, type ApiError } from '$lib/api/errors';
import type { CapturedResponse } from './workspace-fixtures';

/**
 * Responses captured from sakala-api for the bucket endpoints (tests/fixtures/buckets), from the
 * branch of gmedia/sakala-api#204, with Laravel's debug fields dropped. The keys and secrets in
 * them are random test values.
 */
const fixtures = import.meta.glob<CapturedResponse>('../../../tests/fixtures/buckets/*.json', {
	eager: true,
	import: 'default'
});

export function getBucketFixture(name: string): CapturedResponse {
	const fixture = fixtures[`../../../tests/fixtures/buckets/${name}.json`];
	if (!fixture) throw new Error(`No captured response named ${name}`);
	return structuredClone(fixture);
}

export function bucketFixtureNames(): string[] {
	return Object.keys(fixtures).map((path) => path.replace(/^.*\/(.+)\.json$/, '$1'));
}

/** The ApiError the client builds from a captured error response, extra fields included. */
export function errorFromBucketFixture(name: string): ApiError {
	const { status, body } = getBucketFixture(name);
	const { message, code, errors, ...details } = (body ?? {}) as {
		message?: unknown;
		code?: unknown;
		errors?: Record<string, string[]>;
	} & Record<string, unknown>;
	return apiErrorFromResponse(status, { apiMessage: message, code, errors, details });
}

import { apiErrorFromResponse, type ApiError } from '$lib/api/errors';
import type { CapturedResponse } from './workspace-fixtures';

/**
 * Responses captured from sakala-api for the custom domain endpoints (tests/fixtures/domains),
 * from gmedia/sakala-api main 4943fbd (#213), with Laravel's debug fields dropped. A 429 keeps its
 * `Retry-After` under `headers`.
 */
export type CapturedDomainResponse = CapturedResponse & { headers?: Record<string, string> };

const fixtures = import.meta.glob<CapturedDomainResponse>(
	'../../../tests/fixtures/domains/*.json',
	{
		eager: true,
		import: 'default'
	}
);

export function getDomainFixture(name: string): CapturedDomainResponse {
	const fixture = fixtures[`../../../tests/fixtures/domains/${name}.json`];
	if (!fixture) throw new Error(`No captured response named ${name}`);
	return structuredClone(fixture);
}

export function domainFixtureNames(): string[] {
	return Object.keys(fixtures).map((path) => path.replace(/^.*\/(.+)\.json$/, '$1'));
}

/** The ApiError the client builds from a captured error response, extra fields included. */
export function errorFromDomainFixture(name: string): ApiError {
	const { status, body, headers } = getDomainFixture(name);
	const { message, code, errors, ...details } = (body ?? {}) as {
		message?: unknown;
		code?: unknown;
		errors?: Record<string, string[]>;
	} & Record<string, unknown>;
	const retryAfter = headers?.['retry-after'];
	return apiErrorFromResponse(status, {
		apiMessage: message,
		code,
		errors,
		details,
		retryAfterSeconds: retryAfter ? Number(retryAfter) : undefined
	});
}

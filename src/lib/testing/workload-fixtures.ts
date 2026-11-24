import { apiErrorFromResponse, type ApiError } from '$lib/api/errors';
import type { CapturedResponse } from './workspace-fixtures';

/**
 * Responses captured from sakala-api for the worker and schedule endpoints (ADR-022,
 * tests/fixtures/workloads), from main ea7287b (#208) with the feature flags on, except the
 * `*-off` ones. Laravel's debug fields were dropped.
 */
const fixtures = import.meta.glob<CapturedResponse>('../../../tests/fixtures/workloads/*.json', {
	eager: true,
	import: 'default'
});

export function getWorkloadFixture(name: string): CapturedResponse {
	const fixture = fixtures[`../../../tests/fixtures/workloads/${name}.json`];
	if (!fixture) throw new Error(`No captured response named ${name}`);
	return structuredClone(fixture);
}

/** The ApiError the client builds from a captured error response, extra fields included. */
export function errorFromWorkloadFixture(name: string): ApiError {
	const { status, body } = getWorkloadFixture(name);
	const { message, code, errors, ...details } = (body ?? {}) as {
		message?: unknown;
		code?: unknown;
		errors?: Record<string, string[]>;
	} & Record<string, unknown>;
	return apiErrorFromResponse(status, { apiMessage: message, code, errors, details });
}

import { apiErrorFromResponse, type ApiError } from '$lib/api/errors';

/**
 * Responses captured from sakala-api for the workspace endpoints (tests/fixtures/workspaces).
 * Laravel's debug fields (exception, file, line, trace) were dropped: production does not send them.
 */
export type CapturedResponse = { status: number; body: unknown };

const fixtures = import.meta.glob<CapturedResponse>('../../../tests/fixtures/workspaces/*.json', {
	eager: true,
	import: 'default'
});

export function getWorkspaceFixture(name: string): CapturedResponse {
	const fixture = fixtures[`../../../tests/fixtures/workspaces/${name}.json`];
	if (!fixture) throw new Error(`No captured response named ${name}`);
	return structuredClone(fixture);
}

/** The ApiError the client builds from a captured error response. */
export function errorFromFixture(name: string): ApiError {
	const { status, body } = getWorkspaceFixture(name);
	const payload = (body ?? {}) as { message?: unknown; code?: unknown; errors?: never };
	return apiErrorFromResponse(status, {
		apiMessage: payload.message,
		code: payload.code,
		errors: payload.errors
	});
}

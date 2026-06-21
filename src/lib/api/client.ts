import { ensureCsrfCookie, readXsrfToken } from './csrf';
import { ApiError, NetworkError, type ValidationErrors } from './errors';
import { publicConfig } from '$lib/config/public';

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

export type ApiRequestOptions = Omit<RequestInit, 'body'> & {
	json?: unknown;
	body?: BodyInit | null;
	skipCsrf?: boolean;
};

type ErrorPayload = {
	message?: unknown;
	errors?: unknown;
};

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
	const { json, skipCsrf = false, ...requestOptions } = options;
	const method = (requestOptions.method ?? 'GET').toUpperCase();

	if (!safeMethods.has(method) && !skipCsrf) {
		await ensureCsrfCookie();
	}

	const headers = new Headers(requestOptions.headers);
	headers.set('Accept', 'application/json');

	if (json !== undefined) {
		headers.set('Content-Type', 'application/json');
	}

	const xsrfToken = readXsrfToken();
	if (!safeMethods.has(method) && xsrfToken) {
		headers.set('X-XSRF-TOKEN', xsrfToken);
	}

	let response: Response;

	try {
		response = await fetch(new URL(path, withTrailingSlash(publicConfig.apiUrl)), {
			...requestOptions,
			method,
			credentials: 'include',
			headers,
			body: json !== undefined ? JSON.stringify(json) : requestOptions.body
		});
	} catch (error) {
		throw new NetworkError(undefined, error);
	}

	if (!response.ok) {
		throw await createApiError(response);
	}

	if (response.status === 204) {
		return undefined as T;
	}

	return (await response.json()) as T;
}

async function createApiError(response: Response): Promise<ApiError> {
	let payload: ErrorPayload = {};

	try {
		payload = (await response.json()) as ErrorPayload;
	} catch {
		// A non-JSON upstream response still becomes a predictable API error.
	}

	return new ApiError(
		typeof payload.message === 'string'
			? payload.message
			: `Request gagal dengan status ${response.status}.`,
		response.status,
		normalizeValidationErrors(payload.errors)
	);
}

function normalizeValidationErrors(value: unknown): ValidationErrors {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

	return Object.fromEntries(
		Object.entries(value).flatMap(([field, messages]) => {
			if (!Array.isArray(messages)) return [];
			return [
				[field, messages.filter((message): message is string => typeof message === 'string')]
			];
		})
	);
}

function withTrailingSlash(value: string): string {
	return value.endsWith('/') ? value : `${value}/`;
}

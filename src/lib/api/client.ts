import { ensureCsrfCookie, readXsrfToken } from './csrf';
import {
	ApiError,
	apiErrorFromResponse,
	NetworkError,
	parseRetryAfter,
	type ValidationErrors
} from './errors';
import { noteRateLimited, rateLimitRemainingSeconds } from './rate-limit';
import { publicConfig } from '$lib/config/public';

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

export type ApiRequestOptions = Omit<RequestInit, 'body'> & {
	json?: unknown;
	body?: BodyInit | null;
	skipCsrf?: boolean;
	params?: Record<string, string | number | boolean | undefined>;
	/** A read behind its own narrow limit: its 429 says nothing about the shared one, and vice versa. */
	separateRateLimit?: boolean;
};

type ErrorPayload = {
	message?: unknown;
	code?: unknown;
	errors?: unknown;
	retry_after?: unknown;
	[field: string]: unknown;
};

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
	const { json, skipCsrf = false, params, separateRateLimit = false, ...requestOptions } = options;
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

	const url = new URL(path, withTrailingSlash(publicConfig.apiUrl));

	if (params) {
		for (const [key, value] of Object.entries(params)) {
			if (value !== undefined) {
				url.searchParams.set(key, String(value));
			}
		}
	}

	// A read now would only extend the limit. A user's own write still goes through.
	if (safeMethods.has(method) && !separateRateLimit) {
		const remaining = rateLimitRemainingSeconds();
		if (remaining > 0) {
			throw apiErrorFromResponse(429, { retryAfterSeconds: remaining });
		}
	}

	let response: Response;

	try {
		response = await fetch(url, {
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
		const error = await createApiError(response);
		// Writes have their own, narrower limits (login, feedback), which say nothing about reads.
		if (error.isRateLimited && safeMethods.has(method) && !separateRateLimit)
			noteRateLimited(error.retryAfterSeconds);
		throw error;
	}

	if (response.status === 204) {
		return undefined as T;
	}

	return (await response.json()) as T;
}

async function createApiError(response: Response): Promise<ApiError> {
	let payload: ErrorPayload = {};

	try {
		const body: unknown = await response.json();
		if (body && typeof body === 'object' && !Array.isArray(body)) payload = body as ErrorPayload;
	} catch {
		// A non-JSON upstream response still becomes a predictable API error.
	}

	const { message, code, errors, retry_after: retryAfter, ...details } = payload;

	return apiErrorFromResponse(response.status, {
		errors: normalizeValidationErrors(errors),
		apiMessage: message,
		code,
		details,
		// Cross-origin, this header is only readable when the API lists it in exposed_headers.
		retryAfterSeconds:
			parseRetryAfter(response.headers.get('Retry-After')) ??
			(typeof retryAfter === 'number' ? retryAfter : undefined)
	});
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

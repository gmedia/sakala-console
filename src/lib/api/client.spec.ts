import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from './client';
import { ApiError } from './errors';
import { resetRateLimit } from './rate-limit';

function stubResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
	vi.stubGlobal(
		'fetch',
		vi
			.fn()
			.mockResolvedValue(
				new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers })
			)
	);
}

async function requestError(): Promise<ApiError> {
	const error = await apiRequest('api/v1/anything').catch((caught: unknown) => caught);
	expect(error).toBeInstanceOf(ApiError);
	return error as ApiError;
}

afterEach(() => {
	resetRateLimit();
	vi.unstubAllGlobals();
});

describe('apiRequest errors', () => {
	it('carries the code and message of a business error', async () => {
		stubResponse(422, { message: 'Batas proyek tercapai.', code: 'PROJECT_LIMIT_EXCEEDED' });

		const error = await requestError();

		expect(error.status).toBe(422);
		expect(error.code).toBe('PROJECT_LIMIT_EXCEEDED');
		expect(error.message).toBe('Batas proyek tercapai.');
	});

	it('reads Retry-After on 429', async () => {
		stubResponse(429, { message: 'Too Many Attempts.' }, { 'Retry-After': '30' });

		const error = await requestError();

		expect(error.retryAfterSeconds).toBe(30);
		expect(error.message).toContain('30 detik');
	});

	it('reads the wait from the body when CORS hides Retry-After on a GitHub limit', async () => {
		stubResponse(503, {
			message: 'Dibatasi GitHub.',
			code: 'GITHUB_RATE_LIMITED',
			retry_after: 30
		});

		const error = (await apiRequest('/api/v1/x').catch((caught) => caught)) as ApiError;

		expect(error.retryAfterSeconds).toBe(30);
		expect(error.message).toBe('Dibatasi GitHub. Bisa dicoba lagi dalam 30 detik.');
	});

	it('explains a 429 when CORS hides Retry-After', async () => {
		stubResponse(429, { message: 'Too Many Attempts.' });

		const error = await requestError();

		expect(error.retryAfterSeconds).toBeUndefined();
		expect(error.message).toContain('Tunggu sebentar');
	});

	it('keeps per-field errors from a 422', async () => {
		stubResponse(422, {
			message: 'The key has already been taken.',
			errors: { key: ['Key sudah dipakai.'], value: 'bukan-array' }
		});

		const error = await requestError();

		expect(error.errors).toEqual({ key: ['Key sudah dipakai.'] });
	});

	it('survives a non-JSON upstream response', async () => {
		stubResponse(502, '<html>Bad Gateway</html>');

		const error = await requestError();

		expect(error.isServerError).toBe(true);
		expect(error.message).not.toContain('html');
	});
});

describe('while rate limited', () => {
	it('sends no read until the wait is over, and answers with the time left', async () => {
		stubResponse(429, { message: 'Too Many Attempts.' }, { 'Retry-After': '30' });
		await requestError();
		expect(fetch).toHaveBeenCalledOnce();

		const error = await requestError();

		expect(fetch).toHaveBeenCalledOnce();
		expect(error.isRateLimited).toBe(true);
		expect(error.retryAfterSeconds).toBeGreaterThan(0);
		expect(error.retryAfterSeconds).toBeLessThanOrEqual(30);
	});

	it('a refused write does not stop reads, because writes have narrower limits', async () => {
		stubResponse(429, { message: 'Too Many Attempts.' }, { 'Retry-After': '30' });
		await expect(
			apiRequest('api/v1/anything', { method: 'POST', skipCsrf: true })
		).rejects.toBeInstanceOf(ApiError);

		stubResponse(200, { data: {} });
		await apiRequest('api/v1/anything');

		expect(fetch).toHaveBeenCalledOnce();
	});

	it('still lets a write through, because the user asked for it', async () => {
		stubResponse(429, { message: 'Too Many Attempts.' }, { 'Retry-After': '30' });
		await requestError();

		stubResponse(200, { data: {} });
		await apiRequest('api/v1/anything', { method: 'POST', skipCsrf: true });

		expect(fetch).toHaveBeenCalledOnce();
	});
});

import { describe, expect, it } from 'vitest';
import {
	ApiError,
	apiErrorFromResponse,
	getErrorMessage,
	NetworkError,
	parseRetryAfter
} from './errors';

describe('ApiError', () => {
	it('classifies authentication and validation responses', () => {
		const unauthenticated = new ApiError('Unauthenticated.', 401);
		const validation = new ApiError('Data tidak valid.', 422, {
			name: ['Nama wajib diisi.']
		});

		expect(unauthenticated.isUnauthenticated).toBe(true);
		expect(unauthenticated.isForbidden).toBe(false);
		expect(validation.isValidationError).toBe(true);
		expect(validation.errors.name).toEqual(['Nama wajib diisi.']);
	});
});

describe('apiErrorFromResponse', () => {
	it('keeps the code and message of a coded business error', () => {
		const error = apiErrorFromResponse(422, {
			apiMessage: 'Batas proyek tercapai. Kamu bisa membuat 3 proyek selama fase pilot.',
			code: 'PROJECT_LIMIT_EXCEEDED'
		});

		expect(error.code).toBe('PROJECT_LIMIT_EXCEEDED');
		expect(error.message).toBe(
			'Batas proyek tercapai. Kamu bisa membuat 3 proyek selama fase pilot.'
		);
	});

	it('shows a business refusal that has no code yet', () => {
		const error = apiErrorFromResponse(409, { apiMessage: 'Project is suspended.' });

		expect(error.code).toBeUndefined();
		expect(error.message).toBe('Project is suspended.');
	});

	it('prefers the first field error over Laravel\'s "(and 1 more error)" summary', () => {
		const error = apiErrorFromResponse(422, {
			errors: { branch: ['Branch tidak cocok.'], name: ['Nama wajib diisi.'] },
			apiMessage: 'Branch tidak cocok. (and 1 more error)'
		});

		expect(error.message).toBe('Branch tidak cocok.');
	});

	it.each([
		[401, 'Unauthenticated.'],
		[419, 'CSRF token mismatch.'],
		[500, 'SQLSTATE[23000]: Integrity constraint violation'],
		[503, 'Service Unavailable']
	])('never shows the API text for status %i', (status, apiMessage) => {
		const error = apiErrorFromResponse(status, { apiMessage, code: 'SOME_CODE' });

		expect(error.message).not.toContain(apiMessage);
	});

	it.each([
		[403, 'This action is unauthorized.'],
		[409, 'SQLSTATE[23000]: Integrity constraint violation'],
		[404, 'No query results for model [App\\Models\\Project] 12'],
		[403, 'x'.repeat(501)],
		[403, '   '],
		[403, 42]
	])('falls back to the safe text for status %i with unusable message', (status, apiMessage) => {
		const error = apiErrorFromResponse(status, { apiMessage });

		expect(error.message).not.toBe(apiMessage);
		expect(error.message).not.toContain('App\\Models');
		expect(error.message.length).toBeGreaterThan(0);
	});

	it('hides a leaked class name even when a code is present', () => {
		const error = apiErrorFromResponse(404, {
			apiMessage: 'No query results for model [App\\Models\\Project] 12',
			code: 'NOT_FOUND'
		});

		expect(error.message).not.toContain('App\\Models');
		expect(error.code).toBe('NOT_FOUND');
	});

	it('ignores a non-string code', () => {
		expect(apiErrorFromResponse(409, { code: 12 }).code).toBeUndefined();
		expect(apiErrorFromResponse(409, { code: '' }).code).toBeUndefined();
	});

	describe('429', () => {
		it('states the wait in seconds', () => {
			const error = apiErrorFromResponse(429, {
				apiMessage: 'Too Many Attempts.',
				retryAfterSeconds: 42
			});

			expect(error.isRateLimited).toBe(true);
			expect(error.retryAfterSeconds).toBe(42);
			expect(error.message).toContain('Coba lagi dalam 42 detik');
			expect(error.message).not.toContain('Too Many');
		});

		it('rounds a long wait up to minutes', () => {
			expect(apiErrorFromResponse(429, { retryAfterSeconds: 61 }).message).toContain('2 menit');
		});

		it('still explains itself when the header is unreadable', () => {
			const error = apiErrorFromResponse(429);

			expect(error.retryAfterSeconds).toBeUndefined();
			expect(error.message).toContain('Tunggu sebentar');
		});
	});
});

describe('GITHUB_RATE_LIMITED', () => {
	const apiMessage = 'Sakala sedang mencapai batas permintaan ke GitHub.';

	it('shows the API message with the wait, not a generic server error', () => {
		const error = apiErrorFromResponse(503, {
			apiMessage,
			code: 'GITHUB_RATE_LIMITED',
			retryAfterSeconds: 120
		});

		expect(error.isGithubRateLimited).toBe(true);
		expect(error.message).toBe(`${apiMessage} Bisa dicoba lagi dalam 2 menit.`);
	});

	it('still reads well without a wait', () => {
		const error = apiErrorFromResponse(503, { apiMessage, code: 'GITHUB_RATE_LIMITED' });

		expect(error.message).toBe(apiMessage);
	});

	it('has its own words when the API sends none it can show', () => {
		const error = apiErrorFromResponse(503, { code: 'GITHUB_RATE_LIMITED' });

		expect(error.message).toContain('GitHub sedang membatasi');
	});

	it('leaves every other 503 generic', () => {
		const error = apiErrorFromResponse(503, { apiMessage: 'Service Unavailable' });

		expect(error.isGithubRateLimited).toBe(false);
		expect(error.message).toBe('Terjadi kesalahan pada server. Silakan coba lagi nanti.');
	});
});

describe('parseRetryAfter', () => {
	const now = Date.parse('2026-11-05T10:00:00Z');

	it.each([
		['120', 120],
		[' 7 ', 7],
		['0', 0],
		['Thu, 05 Nov 2026 10:00:30 GMT', 30],
		['Thu, 05 Nov 2026 09:00:00 GMT', 0],
		['bukan-tanggal', undefined],
		['', undefined],
		[null, undefined]
	])('parses %s', (value, expected) => {
		expect(parseRetryAfter(value, now)).toBe(expected);
	});
});

describe('getErrorMessage', () => {
	it('uses the text of our own error classes', () => {
		expect(getErrorMessage(new ApiError('Pesan API', 409), 'fallback')).toBe('Pesan API');
		expect(getErrorMessage(new NetworkError(), 'fallback')).toBe(new NetworkError().message);
	});

	it('hides developer errors behind the fallback', () => {
		expect(getErrorMessage(new TypeError('x is not a function'), 'fallback')).toBe('fallback');
		expect(getErrorMessage('boom', 'fallback')).toBe('fallback');
	});
});

describe('EMAIL_DELIVERY_UNAVAILABLE', () => {
	it('shows the API message, not a generic server error', () => {
		const apiMessage = 'Sakala belum bisa mengirim email untuk saat ini.';
		const error = apiErrorFromResponse(503, { apiMessage, code: 'EMAIL_DELIVERY_UNAVAILABLE' });

		expect(error.code).toBe('EMAIL_DELIVERY_UNAVAILABLE');
		expect(error.message).toBe(apiMessage);
	});

	it('has its own words when the API sends none it can show', () => {
		const error = apiErrorFromResponse(503, { code: 'EMAIL_DELIVERY_UNAVAILABLE' });

		expect(error.message).toContain('belum bisa mengirim email');
	});
});

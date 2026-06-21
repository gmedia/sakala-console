import { describe, expect, it } from 'vitest';
import { ApiError } from './errors';

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

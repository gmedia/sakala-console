import { describe, expect, it, vi } from 'vitest';
import { ApiError, NetworkError } from '$lib/api/errors';
import { saveEnvVars, withoutAlreadySaved } from './save-env-vars';

const first = { id: 1, key: 'APP_ENV', value: 'production', isSecret: false };
const second = { id: 2, key: 'DATABASE_URL', value: 'postgres://x', isSecret: true };
const third = { id: 3, key: 'API_KEY', value: 'abc', isSecret: true };

describe('saveEnvVars', () => {
	it('keeps going after one fails, and returns only the failure', async () => {
		const save = vi
			.fn()
			.mockResolvedValueOnce({})
			.mockRejectedValueOnce(new ApiError('Nilai ditolak', 422, { value: ['Nilai ditolak'] }))
			.mockResolvedValueOnce({});
		const onSaved = vi.fn();

		const failures = await saveEnvVars([first, second, third], { save, onSaved });

		expect(save).toHaveBeenCalledTimes(3);
		expect(onSaved).toHaveBeenCalledTimes(2);
		expect(failures).toHaveLength(1);
		expect(failures[0].env.key).toBe('DATABASE_URL');
		expect(failures[0].valueError).toBe('Nilai ditolak');
	});

	it('reports a lost connection in Indonesian, without a field to blame', async () => {
		const save = vi.fn().mockRejectedValue(new NetworkError());

		const [failure] = await saveEnvVars([first], { save });

		expect(failure.message).toBe('Sakala API tidak dapat dijangkau.');
		expect(failure.keyError).toBeUndefined();
	});

	it('never shows a raw error from the code', async () => {
		const save = vi.fn().mockRejectedValue(new TypeError('x is not a function'));

		const [failure] = await saveEnvVars([first], { save });

		expect(failure.message).toBe('Variabel APP_ENV belum tersimpan. Silakan coba lagi.');
	});

	it('stops when the session is gone, because the login redirect takes over', async () => {
		const save = vi.fn().mockRejectedValue(new ApiError('Sesi habis', 401));

		await expect(saveEnvVars([first, second], { save })).rejects.toBeInstanceOf(ApiError);
		expect(save).toHaveBeenCalledOnce();
	});
});

describe('withoutAlreadySaved', () => {
	it('drops a variable the API already has, so its retry is not refused as a duplicate', () => {
		const failures = [
			{ env: first, message: 'gagal' },
			{ env: second, message: 'gagal' }
		];

		expect(withoutAlreadySaved(failures, ['APP_ENV']).map((failure) => failure.env.key)).toEqual([
			'DATABASE_URL'
		]);
	});
});

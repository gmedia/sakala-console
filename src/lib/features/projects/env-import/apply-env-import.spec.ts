import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '$lib/api/errors';
import { applyEnvImport } from './apply-env-import';

const env = (key: string) => ({ key, value: 'v', isSecret: true, looksSecret: false });

describe('applyEnvImport', () => {
	it('adds new keys and overwrites existing ones, one at a time', async () => {
		const add = vi.fn().mockResolvedValue({});
		const overwrite = vi.fn().mockResolvedValue({});
		const result = await applyEnvImport(
			{ toAdd: [env('A'), env('B')], toOverwrite: [env('C')], kept: ['D'] },
			{ add, overwrite }
		);
		expect(result).toEqual({ saved: 3, failures: [] });
		expect(add.mock.calls.map(([item]) => item.key)).toEqual(['A', 'B']);
		expect(overwrite.mock.calls.map(([item]) => item.key)).toEqual(['C']);
	});

	it('keeps going after a refusal and names the variable that failed', async () => {
		const add = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({});
		const result = await applyEnvImport(
			{ toAdd: [env('A'), env('B')], toOverwrite: [], kept: [] },
			{ add, overwrite: vi.fn() }
		);
		expect(result.saved).toBe(1);
		expect(result.failures.map((failure) => failure.key)).toEqual(['A']);
	});

	it('stops when the session is gone', async () => {
		const add = vi.fn().mockRejectedValue(new ApiError('Unauthenticated.', 401));
		await expect(
			applyEnvImport({ toAdd: [env('A')], toOverwrite: [], kept: [] }, { add, overwrite: vi.fn() })
		).rejects.toBeInstanceOf(ApiError);
	});
});

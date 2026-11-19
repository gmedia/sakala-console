import { describe, expect, it } from 'vitest';
import { planEnvImport } from './plan-env-import';

const TEN = Array.from({ length: 10 }, (_, i) => ({ key: `KEY_${i + 1}`, value: `v${i + 1}` }));

describe('planEnvImport', () => {
	it('splits 10 pasted lines with 2 existing keys into 8 new and 2 kept', () => {
		const plan = planEnvImport(TEN, ['KEY_3', 'KEY_7', 'OTHER'], {
			strategy: 'skip',
			storeAllAsSecret: true
		});
		expect(plan.toAdd).toHaveLength(8);
		expect(plan.toOverwrite).toEqual([]);
		expect(plan.kept).toEqual(['KEY_3', 'KEY_7']);
	});

	it('overwrites the existing keys only when asked', () => {
		const plan = planEnvImport(TEN, ['KEY_3', 'KEY_7'], {
			strategy: 'overwrite',
			storeAllAsSecret: true
		});
		expect(plan.toOverwrite.map((env) => env.key)).toEqual(['KEY_3', 'KEY_7']);
		expect(plan.kept).toEqual([]);
	});

	it('keeps credentials secret when the user stores the rest as plain values', () => {
		const plan = planEnvImport(
			[
				{ key: 'APP_ENV', value: 'production' },
				{ key: 'DB_PASSWORD', value: 'kopi' }
			],
			[],
			{ strategy: 'skip', storeAllAsSecret: false }
		);
		expect(plan.toAdd).toEqual([
			{ key: 'APP_ENV', value: 'production', isSecret: false, looksSecret: false },
			{ key: 'DB_PASSWORD', value: 'kopi', isSecret: true, looksSecret: true }
		]);
	});
});

import { describe, expect, it } from 'vitest';
import { describeTruncatedExport } from './account-export';

describe('describeTruncatedExport', () => {
	it('says nothing when everything fit', () => {
		expect(describeTruncatedExport({ truncated: [], max_items_per_collection: 1000 })).toBeNull();
	});

	it('names what was cut, in the words of the screen', () => {
		expect(
			describeTruncatedExport({
				truncated: ['deployments', 'environment_variables'],
				max_items_per_collection: 1000
			})
		).toBe('Daftar deployment, environment variable hanya berisi 1000 item terbaru.');
	});
});

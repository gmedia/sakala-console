import { describe, expect, it } from 'vitest';
import { toRuntimeStatus } from './presentation';

describe('toRuntimeStatus', () => {
	it.each(['not_deployed', 'deploying', 'running', 'stopped', 'failed', 'crashed'])(
		'mengembalikan value asli untuk status valid: %s',
		(status) => {
			expect(toRuntimeStatus(status)).toBe(status);
		}
	);

	it('mengembalikan null untuk string yang bukan runtime status', () => {
		expect(toRuntimeStatus('unknown_status')).toBeNull();
	});

	it('mengembalikan null untuk string kosong', () => {
		expect(toRuntimeStatus('')).toBeNull();
	});

	it('bersifat case-sensitive', () => {
		expect(toRuntimeStatus('Running')).toBeNull();
		expect(toRuntimeStatus('RUNNING')).toBeNull();
	});

	it('mengembalikan null untuk value dengan whitespace tambahan', () => {
		expect(toRuntimeStatus(' running')).toBeNull();
		expect(toRuntimeStatus('running ')).toBeNull();
	});
});

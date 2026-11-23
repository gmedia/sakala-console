import { describe, expect, it } from 'vitest';
import { describeAutoDeployPause } from './auto-deploy-pause';

describe('describeAutoDeployPause', () => {
	it('names the version the rollback went back to and the pushes held since', () => {
		const notice = describeAutoDeployPause(
			{ held_push_count: 2 },
			{ branch: 'main', targetSequence: 4 }
		);
		expect(notice.title).toBe('Auto-deploy dijeda setelah rollback ke #4');
		expect(notice.consequence).toBe(
			'Push ke main dicatat di Riwayat, tetapi tidak di-deploy, supaya versi rollback tidak tertimpa.'
		);
		expect(notice.held).toBe('2 push sudah ditahan.');
		expect(notice.resumeHint).toContain('tidak langsung men-deploy');
	});

	it('stays general without the target, and says nothing of held pushes before there are any', () => {
		const notice = describeAutoDeployPause(
			{ held_push_count: 0 },
			{ branch: 'develop', targetSequence: null }
		);
		expect(notice.title).toBe('Auto-deploy dijeda setelah rollback');
		expect(notice.held).toBeNull();
		expect(notice.consequence).toContain('develop');
	});
});

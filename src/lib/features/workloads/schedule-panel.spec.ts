import { describe, expect, it } from 'vitest';
import type { ScheduleRun } from '$lib/api/resources/schedules';
import { deriveScheduleSteps, runAnchor } from './schedule-panel';

const run = (status: string) => ({ id: 'run-1', status }) as ScheduleRun;

describe('deriveScheduleSteps', () => {
	it('leads to the newest run when it failed, timed out, or was lost', () => {
		for (const status of ['failed', 'timed_out', 'lost']) {
			expect(deriveScheduleSteps({ latest_run: run(status) }, true)).toEqual([
				{ id: 'failed-run', label: 'Lihat run gagal', href: `#${runAnchor('run-1')}` }
			]);
		}
	});

	it('has nothing to suggest without a run, or after one that did not fail', () => {
		expect(deriveScheduleSteps({ latest_run: null }, true)).toEqual([]);
		for (const status of ['succeeded', 'running', 'queued', 'missed', 'skipped', 'cancelled']) {
			expect(deriveScheduleSteps({ latest_run: run(status) }, true)).toEqual([]);
		}
	});

	it('gives a viewer no steps', () => {
		expect(deriveScheduleSteps({ latest_run: run('failed') }, false)).toEqual([]);
	});
});

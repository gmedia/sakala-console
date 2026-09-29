import { describe, expect, it } from 'vitest';
import type { DeploymentStep } from './type';
import {
	deriveCurrentStepLabel,
	deriveDurationLabel,
	deriveFailedStepLabel,
	deriveLastUpdateTimestamp,
	formatDeploymentTime,
	getDeploymentTriggerLabel
} from './deployment-presentation';
import type { DeploymentEvent } from '$lib/api/resources/deployment';

function createEvent(overrides: Partial<DeploymentEvent> = {}): DeploymentEvent {
	return {
		sequence: 1,
		level: 'info',
		type: 'deployment.checkout.started',
		message: 'Event',
		metadata: null,
		occurred_at: '2026-09-20T10:00:00Z',
		...overrides
	};
}

describe('getDeploymentTriggerLabel', () => {
	it.each([
		['manual', 'Manual'],
		['redeploy', 'Manual redeploy'],
		['webhook', 'Push'],
		['system', 'System']
	])('maps %s to %s', (trigger, expected) => {
		expect(getDeploymentTriggerLabel(trigger)).toBe(expected);
	});

	it('returns the original value for an unknown trigger', () => {
		expect(getDeploymentTriggerLabel('unknown')).toBe('unknown');
	});
});

describe('deriveCurrentStepLabel', () => {
	it('returns the title of the running step', () => {
		const steps: DeploymentStep[] = [
			{
				key: 'build',
				title: 'Build project',
				status: 'success',
				timestamp: '08:41:10'
			},
			{
				key: 'deploy',
				title: 'Deploy application',
				status: 'running',
				timestamp: '08:41:20'
			}
		];

		expect(deriveCurrentStepLabel(steps)).toBe('Deploy application');
	});

	it('returns undefined when there is no running step', () => {
		const steps: DeploymentStep[] = [
			{
				key: 'build',
				title: 'Build project',
				status: 'success',
				timestamp: '08:41:10'
			},
			{
				key: 'deploy',
				title: 'Deploy application',
				status: 'pending'
			}
		];

		expect(deriveCurrentStepLabel(steps)).toBeUndefined();
	});

	it('returns undefined for an empty step list', () => {
		expect(deriveCurrentStepLabel([])).toBeUndefined();
	});
});

describe('deriveFailedStepLabel', () => {
	it('returns the title of the failed step', () => {
		const steps: DeploymentStep[] = [
			{
				key: 'build',
				title: 'Build project',
				status: 'failed',
				timestamp: '08:41:10'
			},
			{
				key: 'deploy',
				title: 'Deploy application',
				status: 'pending'
			}
		];

		expect(deriveFailedStepLabel(steps)).toBe('Build project');
	});

	it('returns undefined when there is no failed step', () => {
		const steps: DeploymentStep[] = [
			{
				key: 'build',
				title: 'Build project',
				status: 'success'
			},
			{
				key: 'deploy',
				title: 'Deploy application',
				status: 'running'
			}
		];

		expect(deriveFailedStepLabel(steps)).toBeUndefined();
	});

	it('returns undefined for an empty step list', () => {
		expect(deriveFailedStepLabel([])).toBeUndefined();
	});
});

describe('deriveLastUpdateTimestamp', () => {
	it('pakai latest event timestamp saat events ada', () => {
		const events = [
			createEvent({ sequence: 1, occurred_at: '2026-09-20T10:00:00Z' }),
			createEvent({ sequence: 2, occurred_at: '2026-09-20T10:05:00Z' })
		];

		const result = deriveLastUpdateTimestamp(events);

		expect(result).not.toBe('-');
		expect(result).toMatch(/^\d{2}[:.]\d{2}[:.]\d{2}$/);
	});

	it('fallback ke finished_at kalau events kosong & deployment selesai', () => {
		const result = deriveLastUpdateTimestamp([], {
			created_at: '2026-09-20T09:00:00Z',
			started_at: '2026-09-20T09:05:00Z',
			finished_at: '2026-09-20T09:10:00Z'
		});

		expect(result).not.toBe('-');
		expect(result).toMatch(/^\d{2}[:.]\d{2}[:.]\d{2}$/);
	});

	it('fallback ke cancelled_at kalau events kosong & deployment cancelled', () => {
		const result = deriveLastUpdateTimestamp([], {
			created_at: '2026-09-20T09:00:00Z',
			started_at: '2026-09-20T09:05:00Z',
			finished_at: null,
			cancelled_at: '2026-09-20T09:07:00Z'
		});

		expect(result).not.toBe('-');
		expect(result).toMatch(/^\d{2}[:.]\d{2}[:.]\d{2}$/);
	});

	it('fallback ke started_at kalau events kosong & deployment running', () => {
		const result = deriveLastUpdateTimestamp([], {
			created_at: '2026-09-20T09:00:00Z',
			started_at: '2026-09-20T09:05:00Z',
			finished_at: null,
			cancelled_at: null
		});

		expect(result).not.toBe('-');
		expect(result).toMatch(/^\d{2}[:.]\d{2}[:.]\d{2}$/);
	});

	it('fallback ke created_at kalau events kosong & deployment belum mulai', () => {
		const result = deriveLastUpdateTimestamp([], {
			created_at: '2026-09-20T09:00:00Z',
			started_at: null,
			finished_at: null,
			cancelled_at: null
		});

		expect(result).not.toBe('-');
		expect(result).toMatch(/^\d{2}[:.]\d{2}[:.]\d{2}$/);
	});

	it('kembalikan "-" kalau events kosong & semua lifecycle null', () => {
		const result = deriveLastUpdateTimestamp([], {
			created_at: null,
			started_at: null,
			finished_at: null,
			cancelled_at: null
		});

		expect(result).toBe('-');
	});

	it('kembalikan "-" kalau events kosong & lifecycle tidak di-pass', () => {
		expect(deriveLastUpdateTimestamp([])).toBe('-');
	});

	it('prioritaskan event meskipun lifecycle lebih baru', () => {
		const events = [createEvent({ occurred_at: '2026-09-20T10:00:00Z' })];

		const result = deriveLastUpdateTimestamp(events, {
			finished_at: '2026-09-20T11:00:00Z'
		});

		expect(result).not.toBe('-');
	});

	it('abaikan event dengan sequence duplikat (tetap pakai yang pertama)', () => {
		const events = [
			createEvent({ sequence: 1, occurred_at: '2026-09-20T10:00:00Z' }),
			createEvent({ sequence: 1, occurred_at: '2026-09-20T11:00:00Z' })
		];

		const result = deriveLastUpdateTimestamp(events);

		expect(result).not.toBe('-');
	});
});

describe('deriveDurationLabel', () => {
	it('returns the duration in seconds', () => {
		expect(deriveDurationLabel('2026-09-12T08:41:02+07:00', '2026-09-12T08:41:49+07:00')).toBe(
			'47 detik'
		);
	});

	it('rounds fractional seconds to the nearest second', () => {
		expect(
			deriveDurationLabel('2026-09-12T08:41:02.000+07:00', '2026-09-12T08:41:02.600+07:00')
		).toBe('1 detik');
	});

	it('returns undefined when finishedAt is null', () => {
		expect(deriveDurationLabel('2026-09-12T08:41:02+07:00', null)).toBeUndefined();
	});
});

describe('formatDeploymentTime', () => {
	it('formats timestamp with hours, minutes, and seconds', () => {
		const timestamp = new Date(2026, 8, 13, 8, 41, 2).toISOString();

		expect(formatDeploymentTime(timestamp)).toBe('08.41.02');
	});

	it('pads single-digit time values', () => {
		const timestamp = new Date(2026, 8, 13, 8, 1, 2).toISOString();

		expect(formatDeploymentTime(timestamp)).toBe('08.01.02');
	});
});

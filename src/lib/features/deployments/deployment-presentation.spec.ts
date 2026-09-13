import { describe, expect, it } from 'vitest';
import type { DeploymentStep } from './type';
import {
	deriveCurrentStepLabel,
	deriveDurationLabel,
	deriveFailedStepLabel,
	formatDeploymentTime,
	getDeploymentTriggerLabel
} from './deployment-presentation';

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

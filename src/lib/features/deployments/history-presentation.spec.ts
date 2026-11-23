import { describe, expect, it } from 'vitest';
import {
	describeDeploymentTrigger,
	getHistoryTriggerNote,
	getRollbackLabel,
	isServingDeployment,
	type TriggerDeployment
} from './history-presentation';

function deployment(overrides: Partial<TriggerDeployment> = {}): TriggerDeployment {
	return { trigger: 'redeploy', branch: 'main', ...overrides };
}

const rani = { kind: 'user', name: 'Rani', user_id: 12 } as const;
const bima = { kind: 'github_push', name: 'Bima', user_id: null } as const;

describe('isServingDeployment', () => {
	it('marks the active deployment while the project runs, sleeps, or deploys over it', () => {
		for (const status of ['running', 'sleeping', 'deploying']) {
			expect(isServingDeployment({ is_active: true }, status)).toBe(true);
		}
	});

	it('marks nothing when the project crashed, stopped, failed, or never went live', () => {
		for (const status of ['crashed', 'stopped', 'failed', 'not_deployed', undefined]) {
			expect(isServingDeployment({ is_active: true }, status)).toBe(false);
		}
	});

	it('never marks a deployment that is not active', () => {
		expect(isServingDeployment({ is_active: false }, 'running')).toBe(false);
	});
});

describe('describeDeploymentTrigger', () => {
	it('names who started it in a team workspace', () => {
		expect(describeDeploymentTrigger(deployment({ triggered_by: rani }), 'team')).toBe(
			'Rani, redeploy manual'
		);
		expect(
			describeDeploymentTrigger(deployment({ trigger: 'manual', triggered_by: rani }), 'team')
		).toBe('Rani, deploy manual');
		expect(
			describeDeploymentTrigger(
				deployment({ trigger: 'webhook', branch: 'develop', triggered_by: bima }),
				'team'
			)
		).toBe('Bima, push ke develop');
		expect(
			describeDeploymentTrigger(
				deployment({
					trigger: 'rollback',
					triggered_by: rani,
					rollback: { target_deployment_id: 'd4', target_sequence: 4 }
				}),
				'team'
			)
		).toBe('Rani, rollback ke #4');
	});

	it('keeps the plain labels in a personal workspace', () => {
		expect(describeDeploymentTrigger(deployment({ triggered_by: rani }), 'personal')).toBe(
			'Manual redeploy'
		);
		expect(
			describeDeploymentTrigger(deployment({ trigger: 'webhook', triggered_by: bima }), 'personal')
		).toBe('Auto-deploy dari push');
	});

	it('keeps the plain label without a name, for a system deployment, or from an older API', () => {
		expect(
			describeDeploymentTrigger(
				deployment({ trigger: 'webhook', triggered_by: { ...bima, name: null } }),
				'team'
			)
		).toBe('Auto-deploy dari push');
		expect(
			describeDeploymentTrigger(
				deployment({ trigger: 'webhook', triggered_by: { ...bima, name: '  ' } }),
				'team'
			)
		).toBe('Auto-deploy dari push');
		expect(
			describeDeploymentTrigger(
				deployment({
					trigger: 'database_ready',
					triggered_by: { kind: 'system', name: null, user_id: null }
				}),
				'team'
			)
		).toBe('Deploy pertama setelah database siap');
		expect(describeDeploymentTrigger(deployment(), 'team')).toBe('Manual redeploy');
		expect(describeDeploymentTrigger(deployment({ triggered_by: rani }), undefined)).toBe(
			'Manual redeploy'
		);
	});

	it('says which version a rollback went back to, in any workspace', () => {
		const rollback = deployment({
			trigger: 'rollback',
			rollback: { target_deployment_id: 'd4', target_sequence: 4 }
		});
		expect(describeDeploymentTrigger(rollback, 'personal')).toBe('Rollback ke #4');
		expect(
			describeDeploymentTrigger(
				{ ...rollback, rollback: { target_deployment_id: null, target_sequence: null } },
				'team'
			)
		).toBe('Rollback');
		expect(
			describeDeploymentTrigger({ ...rollback, triggered_by: rani, rollback: null }, 'team')
		).toBe('Rani, rollback');
	});
});

describe('getRollbackLabel', () => {
	it('never carries a name', () => {
		expect(
			getRollbackLabel(
				deployment({
					trigger: 'rollback',
					triggered_by: rani,
					rollback: { target_deployment_id: 'd4', target_sequence: 4 }
				})
			)
		).toBe('Rollback ke #4');
	});
});

describe('getHistoryTriggerNote', () => {
	it('adds nothing to a personal history row but a rollback', () => {
		expect(getHistoryTriggerNote(deployment({ triggered_by: rani }), 'personal')).toBeNull();
		expect(
			getHistoryTriggerNote(
				deployment({
					trigger: 'rollback',
					rollback: { target_deployment_id: 'd4', target_sequence: 4 }
				}),
				'personal'
			)
		).toBe('Rollback ke #4');
	});

	it('names the actor on every team history row', () => {
		expect(getHistoryTriggerNote(deployment({ triggered_by: rani }), 'team')).toBe(
			'Rani, redeploy manual'
		);
	});
});

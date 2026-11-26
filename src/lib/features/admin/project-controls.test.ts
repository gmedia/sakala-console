import { describe, expect, it } from 'vitest';
import { DANGER_CONTROLS, availableControls } from './project-controls';

describe('project controls', () => {
	it('offers a serving project reconcile, stop, and suspend, two of them as danger', () => {
		const actions = availableControls({ status: 'active', active_deployment_id: 'd1' });
		expect(actions).toEqual(['reconcile', 'stop', 'suspend']);
		expect(actions.filter((action) => DANGER_CONTROLS.includes(action))).toEqual([
			'stop',
			'suspend'
		]);
	});

	it('offers only suspend without a serving deployment, and only unsuspend once suspended', () => {
		expect(availableControls({ status: 'active', active_deployment_id: null })).toEqual([
			'suspend'
		]);
		expect(availableControls({ status: 'suspended', active_deployment_id: 'd1' })).toEqual([
			'unsuspend'
		]);
	});
});

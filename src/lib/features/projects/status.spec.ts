import { describe, it, expect } from 'vitest';
import { ACTIVE_DEPLOYMENT_STATUSES } from './type';

describe('Deployment status contract', () => {
	it('includes all non-terminal stages in ACTIVE_DEPLOYMENT_STATUSES for polling', () => {
		expect(ACTIVE_DEPLOYMENT_STATUSES).toContain('queued');
		expect(ACTIVE_DEPLOYMENT_STATUSES).toContain('cloning');
		expect(ACTIVE_DEPLOYMENT_STATUSES).toContain('analyzing');
		expect(ACTIVE_DEPLOYMENT_STATUSES).toContain('building');
		expect(ACTIVE_DEPLOYMENT_STATUSES).toContain('deploying');
		expect(ACTIVE_DEPLOYMENT_STATUSES).toContain('routing');
		expect(ACTIVE_DEPLOYMENT_STATUSES).toContain('health_checking');

		expect(ACTIVE_DEPLOYMENT_STATUSES).not.toContain('succeeded');
		expect(ACTIVE_DEPLOYMENT_STATUSES).not.toContain('failed');
		expect(ACTIVE_DEPLOYMENT_STATUSES).not.toContain('cancelled');
	});
});

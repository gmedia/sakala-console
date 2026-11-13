import { describe, it, expect } from 'vitest';
import openapi from '$lib/api/generated/openapi.json';
import { runtimeStatus as adminRuntimeStatus } from '$lib/features/admin/format';
import { runtimeStatusPresentation, toRuntimeStatus } from './presentation';
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

describe('Runtime status contract', () => {
	const apiStatuses: string[] = openapi.components.schemas.RuntimeStatus.enum;

	it('has a label for every runtime status the API documents, sleeping included', () => {
		expect(apiStatuses).toContain('sleeping');
		for (const status of apiStatuses) {
			expect(toRuntimeStatus(status), status).toBe(status);
			expect(adminRuntimeStatus(status).label, status).not.toBe(status);
		}
		expect(Object.keys(runtimeStatusPresentation).sort()).toEqual([...apiStatuses].sort());
	});
});

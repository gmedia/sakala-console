import { describe, expect, it } from 'vitest';
import { notificationHref } from './presentation';

describe('notificationHref', () => {
	it('leads to the deployment, then the project, and otherwise nowhere', () => {
		expect(notificationHref({ project_id: 'p', deployment_id: 'd' })).toBe(
			'/projects/p/deployments/d'
		);
		expect(notificationHref({ project_id: 'p', deployment_id: null })).toBe('/projects/p');
		expect(notificationHref({ project_id: null, deployment_id: null })).toBeNull();
	});

	it('opens the invitation list for a workspace notification, which carries no invitation ID', () => {
		expect(notificationHref({ category: 'workspace', project_id: null, deployment_id: null })).toBe(
			'/workspace-invitations'
		);
	});
});

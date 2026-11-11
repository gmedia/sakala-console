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

	it('opens the invitation a workspace notification is about', () => {
		expect(
			notificationHref({
				category: 'workspace',
				project_id: null,
				deployment_id: null,
				invitation_id: '01a1cb4a-0000-7000-8000-000000000001',
				workspace_id: null
			})
		).toBe('/workspace-invitations/01a1cb4a-0000-7000-8000-000000000001');
	});

	it('opens the team for a membership notice, which has no invitation', () => {
		expect(
			notificationHref({
				category: 'workspace',
				project_id: null,
				deployment_id: null,
				invitation_id: null,
				workspace_id: 'team-1'
			})
		).toBe('/workspaces/team-1');
	});

	it('opens the invitation list for an older workspace notice without IDs', () => {
		expect(notificationHref({ category: 'workspace', project_id: null, deployment_id: null })).toBe(
			'/workspace-invitations'
		);
	});
});

import { describe, expect, it, vi } from 'vitest';
import {
	auditHref,
	deriveAdminAgentSteps,
	deriveAdminDeploymentSteps,
	deriveAdminProjectSteps,
	deriveAdminUserSteps,
	deriveAdminWorkspaceSteps
} from './panel';
import { MAX_PANEL_STEPS } from '$lib/components/panel/panel';

vi.mock('$app/paths', () => ({ resolve: (path: string) => path }));

const project = (deployments = 3) => ({
	deployments_count: deployments,
	project: { id: 'p1', slug: 'toko-kue' }
});

describe('admin panel steps', () => {
	it('opens the audit log filtered to one subject', () => {
		expect(auditHref('agent_node', 'a 1')).toBe(
			'/admin/audit?subject_type=agent_node&subject_id=a+1'
		);
	});

	it('leads a project to its failures and its audit trail', () => {
		const steps = deriveAdminProjectSteps(project());
		expect(steps.map((step) => step.href)).toEqual([
			'/admin/failures?range=all&search=toko-kue',
			'/admin/audit?subject_type=project&subject_id=p1'
		]);
		expect(steps.length).toBeLessThanOrEqual(MAX_PANEL_STEPS);
	});

	it('offers only the audit trail to a project that never deployed', () => {
		expect(deriveAdminProjectSteps(project(0)).map((step) => step.id)).toEqual(['audit']);
	});

	it('links a user to their personal workspace when there is one', () => {
		expect(
			deriveAdminUserSteps({
				user: { id: 7 },
				workspaces: [
					{ id: 'team', type: 'team' },
					{ id: 'own', type: 'personal' }
				]
			}).map((step) => step.href)
		).toEqual(['/admin/workspaces/own', '/admin/audit?subject_type=user&subject_id=7']);
		expect(deriveAdminUserSteps({ user: { id: 7 }, workspaces: [] })).toHaveLength(1);
	});

	it('links a workspace to its limit profile only when it has one', () => {
		expect(
			deriveAdminWorkspaceSteps({
				workspace: { id: 'w1', limit_profile: { id: 'lp', name: 'Kelas' } }
			}).map((step) => step.href)
		).toEqual(['/admin/limit-profiles/lp', '/admin/audit?subject_type=workspace&subject_id=w1']);
		expect(
			deriveAdminWorkspaceSteps({ workspace: { id: 'w1', limit_profile: null } }).map(
				(step) => step.id
			)
		).toEqual(['audit']);
	});

	it('filters a node to its failed commands', () => {
		expect(deriveAdminAgentSteps({ id: 'n1' }).map((step) => step.href)).toEqual([
			'/admin/agents/n1?status=Failed',
			'/admin/audit?subject_type=agent_node&subject_id=n1'
		]);
	});

	it('finds failures like this one, by category and code when the code is known', () => {
		expect(
			deriveAdminDeploymentSteps({
				deployment: { id: 'd1', failure: { category: 'build', code: 'BUILD_FAILED' } }
			})[0].href
		).toBe('/admin/failures?range=all&category=build&code=BUILD_FAILED');
		expect(
			deriveAdminDeploymentSteps({
				deployment: { id: 'd1', failure: { category: 'build', code: null } }
			})[0].href
		).toBe('/admin/failures?range=all&category=build');
		expect(
			deriveAdminDeploymentSteps({ deployment: { id: 'd1', failure: null } }).map((step) => step.id)
		).toEqual(['audit']);
	});
});

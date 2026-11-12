import { describe, expect, it } from 'vitest';
import type { AdminWorkspaceDetail } from '$lib/api/resources/admin/accounts';
import { DOCUMENTED_TEAM_DEFAULTS, profilePrefill } from './profile-defaults';

const limits = {
	max_projects: 4,
	max_active_containers: 3,
	max_active_deployments: 2,
	max_memory_mb: 768,
	max_cpu_millis: 1500,
	max_builds_per_hour: null,
	max_active_deployments_per_project: 1
};

function detail(type: string, limitProfile: { id: string; name: string } | null) {
	return {
		workspace: { type },
		quota: { limit_profile: limitProfile, limits }
	} as unknown as AdminWorkspaceDetail;
}

describe('profilePrefill', () => {
	it('takes the live team default from a team workspace that runs on it', () => {
		expect(profilePrefill(detail('team', null))).toEqual({
			source: 'workspace',
			numbers: {
				max_projects: 4,
				max_active_containers: 3,
				max_active_deployments: 2,
				max_memory_mb: 768,
				max_cpu_millis: 1500
			}
		});
	});

	it('falls back to the documented team defaults otherwise', () => {
		for (const value of [
			undefined,
			detail('personal', null),
			detail('team', { id: 'p', name: 'Kelas' })
		]) {
			expect(profilePrefill(value)).toEqual({
				source: 'documented',
				numbers: DOCUMENTED_TEAM_DEFAULTS
			});
		}
		expect(DOCUMENTED_TEAM_DEFAULTS).toEqual({
			max_projects: 2,
			max_active_containers: 2,
			max_active_deployments: 1,
			max_memory_mb: 512,
			max_cpu_millis: 1000
		});
	});
});

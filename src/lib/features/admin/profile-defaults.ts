import type { AdminWorkspaceDetail, LimitProfile } from '$lib/api/resources/admin/accounts';

export type ProfileNumbers = Pick<
	LimitProfile,
	| 'max_projects'
	| 'max_active_containers'
	| 'max_active_deployments'
	| 'max_memory_mb'
	| 'max_cpu_millis'
>;

/**
 * What a team without a profile gets when the server keeps its defaults (sakala-api
 * `config/sakala.php`, `workspaces.team_limits`): 2 projects, 2 running containers, 1 running
 * deployment, and the personal memory and CPU caps, 512 MB and 1,000 millicore. The API has no
 * endpoint for these, so the form only uses them when no team workspace on the default is at hand.
 */
export const DOCUMENTED_TEAM_DEFAULTS: ProfileNumbers = {
	max_projects: 2,
	max_active_containers: 2,
	max_active_deployments: 1,
	max_memory_mb: 512,
	max_cpu_millis: 1000
};

export type ProfilePrefill = { numbers: ProfileNumbers; source: 'workspace' | 'documented' };

/**
 * Starting numbers for a new profile: the live team default when the form was opened for a team
 * workspace that runs on it (the API reports those limits in the workspace's quota), otherwise the
 * documented team defaults.
 */
export function profilePrefill(detail: AdminWorkspaceDetail | undefined): ProfilePrefill {
	if (detail?.workspace.type === 'team' && detail.quota.limit_profile === null) {
		const { max_projects, max_active_containers, max_active_deployments } = detail.quota.limits;
		const { max_memory_mb, max_cpu_millis } = detail.quota.limits;
		return {
			numbers: {
				max_projects,
				max_active_containers,
				max_active_deployments,
				max_memory_mb,
				max_cpu_millis
			},
			source: 'workspace'
		};
	}
	return { numbers: DOCUMENTED_TEAM_DEFAULTS, source: 'documented' };
}

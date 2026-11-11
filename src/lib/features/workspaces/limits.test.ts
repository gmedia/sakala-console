import { describe, expect, it } from 'vitest';
import { parsePilotLimitsResponse } from '$lib/api/resources/pilot-limits';
import { getWorkspaceFixture } from '$lib/testing/workspace-fixtures';
import { workspaceLimitRows } from './limits';

describe('workspaceLimitRows', () => {
	it('shows projects, running deployments, and active apps of a team', () => {
		const limits = parsePilotLimitsResponse(getWorkspaceFixture('pilot-limits-team').body);
		expect(workspaceLimitRows(limits)).toEqual([
			{ label: 'Proyek', used: 1, max: 5, reached: false },
			{ label: 'Deployment berjalan', used: 0, max: 2, reached: false },
			{ label: 'Aplikasi aktif', used: 0, max: 3, reached: false }
		]);
	});

	it('leaves out active apps for an API that does not report them', () => {
		const rows = workspaceLimitRows({
			quotas: {
				max_projects_per_user: 3,
				max_active_deployments_per_user: 2,
				max_active_deployments_per_project: 1,
				current_projects_count: 3,
				current_active_deployments_count: 0
			}
		});
		expect(rows.map((row) => row.label)).toEqual(['Proyek', 'Deployment berjalan']);
		expect(rows[0].reached).toBe(true);
	});
});

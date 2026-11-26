import { describe, expect, it } from 'vitest';
import { parsePilotLimitsResponse } from '$lib/api/resources/pilot-limits';
import { getWorkspaceFixture } from '$lib/testing/workspace-fixtures';
import {
	formatIdleSleep,
	limitBadgeLabel,
	replicasLine,
	workspaceBuildsPerHourSummary,
	workspaceIdleSleepSummary,
	workspaceLimitRows,
	workspaceReplicasSummary
} from './limits';

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

describe('limitBadgeLabel', () => {
	it('reads as used of max, then what is counted', () => {
		const limits = parsePilotLimitsResponse(getWorkspaceFixture('pilot-limits-team').body);
		expect(workspaceLimitRows(limits).map(limitBadgeLabel)).toEqual([
			'1 dari 5 proyek',
			'0 dari 2 deployment berjalan',
			'0 dari 3 aplikasi aktif'
		]);
	});

	it('writes large numbers the Indonesian way', () => {
		expect(limitBadgeLabel({ label: 'Proyek', used: 1200, max: 10000 })).toBe(
			'1.200 dari 10.000 proyek'
		);
	});
});

describe('workspaceIdleSleepSummary', () => {
	it('says after how many minutes without visitors a project sleeps, and that it wakes', () => {
		expect(workspaceIdleSleepSummary({ project_idle_sleep_minutes: 30 })).toBe(
			'Tidur otomatis: setelah 30 menit tanpa pengunjung, lalu menyala lagi saat URL-nya dibuka.'
		);
	});

	it('says never for a workspace whose projects do not sleep', () => {
		expect(workspaceIdleSleepSummary({ project_idle_sleep_minutes: 0 })).toBe(
			'Tidur otomatis: tidak pernah.'
		);
	});

	it('says nothing for an API that does not report it', () => {
		expect(workspaceIdleSleepSummary({})).toBeNull();
	});

	it('writes large numbers the Indonesian way', () => {
		expect(formatIdleSleep(10080)).toBe('setelah 10.080 menit tanpa pengunjung');
	});
});

describe('replicas in the workspace limits', () => {
	const quotas = parsePilotLimitsResponse(getWorkspaceFixture('pilot-limits-team').body).quotas;

	it('says how many replicas a project may run, and that each takes an active app', () => {
		expect(workspaceReplicasSummary({ quotas: { ...quotas, max_replicas: 3 } })).toBe(
			'Replika: paling banyak 3 per proyek. Setiap replika dihitung sebagai satu aplikasi aktif.'
		);
		expect(replicasLine(3)).toBe('Replika: paling banyak 3 per proyek.');
	});

	it('says replicas are not available at one', () => {
		expect(workspaceReplicasSummary({ quotas: { ...quotas, max_replicas: 1 } })).toBe(
			'Replika belum aktif untuk workspace ini. Admin Sakala bisa mengaktifkannya lewat profil batas workspace.'
		);
	});

	it('says nothing for an API that does not report replicas, like this recorded answer', () => {
		expect(quotas.max_replicas).toBeUndefined();
		expect(workspaceReplicasSummary({ quotas })).toBeNull();
	});
});

describe('workspaceBuildsPerHourSummary', () => {
	const quotas = {
		max_projects_per_user: 3,
		max_active_deployments_per_user: 2,
		max_active_deployments_per_project: 1,
		current_projects_count: 0,
		current_active_deployments_count: 0
	};

	it('says how many builds an hour the workspace may start, and what counts', () => {
		expect(workspaceBuildsPerHourSummary({ quotas: { ...quotas, max_builds_per_hour: 20 } })).toBe(
			'Build per jam: paling banyak 20 deployment yang membangun image dalam 60 menit terakhir, termasuk yang gagal. Redeploy yang memakai ulang image tidak dihitung.'
		);
	});

	it('says there is no limit when the server sets none', () => {
		expect(
			workspaceBuildsPerHourSummary({ quotas: { ...quotas, max_builds_per_hour: null } })
		).toBe('Build per jam: tidak dibatasi.');
	});

	it('says nothing for an API that does not report it', () => {
		expect(workspaceBuildsPerHourSummary({ quotas })).toBeNull();
	});

	it('is read from the API response', () => {
		const body = getWorkspaceFixture('pilot-limits-team').body as {
			data: { quotas: Record<string, unknown> };
		};
		const limits = parsePilotLimitsResponse({
			...body,
			data: { ...body.data, quotas: { ...body.data.quotas, max_builds_per_hour: 1000 } }
		});
		expect(workspaceBuildsPerHourSummary(limits)).toMatch(/^Build per jam: paling banyak 1\.000 /);
	});
});

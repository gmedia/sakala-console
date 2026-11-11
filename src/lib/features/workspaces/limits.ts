import type { PilotLimits } from '$lib/api/resources/pilot-limits';

export type LimitRow = { label: string; used: number; max: number; reached: boolean };

/** The usage the API reports for one workspace. Containers only appear when the API sends them. */
export function workspaceLimitRows(limits: Pick<PilotLimits, 'quotas'>): LimitRow[] {
	const q = limits.quotas;
	const rows: LimitRow[] = [
		row('Proyek', q.current_projects_count, q.max_projects_per_user),
		row(
			'Deployment berjalan',
			q.current_active_deployments_count,
			q.max_active_deployments_per_user
		)
	];
	if (q.max_active_containers !== undefined && q.current_active_containers_count !== undefined) {
		rows.push(row('Aplikasi aktif', q.current_active_containers_count, q.max_active_containers));
	}
	return rows;
}

function row(label: string, used: number, max: number): LimitRow {
	return { label, used, max, reached: used >= max };
}

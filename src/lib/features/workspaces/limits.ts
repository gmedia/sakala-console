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

/** `project_idle_sleep_minutes` of `0`: the workspace's projects never sleep. */
export const IDLE_SLEEP_NEVER = 0;

const IDLE_SLEEP_LABEL = 'Tidur otomatis';

const count = new Intl.NumberFormat('id-ID');

/** How long a project of the workspace stays up without visitors, in words. */
export function formatIdleSleep(minutes: number): string {
	return minutes === IDLE_SLEEP_NEVER
		? 'tidak pernah'
		: `setelah ${count.format(minutes)} menit tanpa pengunjung`;
}

/** One line for a limits card, the same for members and admins. */
export function idleSleepLine(minutes: number): string {
	return `${IDLE_SLEEP_LABEL}: ${formatIdleSleep(minutes)}.`;
}

/** `null` for an API that does not report the idle window yet. */
export function workspaceIdleSleepSummary(
	limits: Pick<PilotLimits, 'project_idle_sleep_minutes'>
): string | null {
	const minutes = limits.project_idle_sleep_minutes;
	if (minutes === undefined) return null;
	return minutes === IDLE_SLEEP_NEVER
		? idleSleepLine(minutes)
		: `${IDLE_SLEEP_LABEL}: ${formatIdleSleep(minutes)}, lalu menyala lagi saat URL-nya dibuka.`;
}

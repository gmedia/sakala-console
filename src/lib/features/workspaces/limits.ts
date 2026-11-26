import type { PilotLimits } from '$lib/api/resources/pilot-limits';
import { REPLICAS_COPY, replicasAvailable } from '$lib/features/projects/replicas';

const count = new Intl.NumberFormat('id-ID');

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

/** A usage row as one badge under the workspace's name: "1 dari 5 proyek". */
export function limitBadgeLabel(limit: Pick<LimitRow, 'label' | 'used' | 'max'>): string {
	return `${count.format(limit.used)} dari ${count.format(limit.max)} ${limit.label.toLowerCase()}`;
}

function row(label: string, used: number, max: number): LimitRow {
	return { label, used, max, reached: used >= max };
}

/** One line about replicas for a limits card, the same for members and admins. */
export function replicasLine(maxReplicas: number): string {
	return replicasAvailable(maxReplicas)
		? `${REPLICAS_COPY.label}: paling banyak ${count.format(maxReplicas)} per proyek.`
		: REPLICAS_COPY.unavailable;
}

/**
 * The replica line for members, who see running containers as active apps: each replica takes one.
 * `null` for an API that does not report replicas yet.
 */
export function workspaceReplicasSummary(limits: Pick<PilotLimits, 'quotas'>): string | null {
	const max = limits.quotas.max_replicas;
	if (max === undefined) return null;
	return replicasAvailable(max)
		? `${replicasLine(max)} Setiap replika dihitung sebagai satu aplikasi aktif.`
		: replicasLine(max);
}

/** `project_idle_sleep_minutes` of `0`: the workspace's projects never sleep. */
export const IDLE_SLEEP_NEVER = 0;

const IDLE_SLEEP_LABEL = 'Tidur otomatis';

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

/** The same name the admin limit profile uses for the column and the field. */
const BUILDS_PER_HOUR_LABEL = 'Build per jam';

/**
 * The build rate limit for members. The API sends the value already resolved from the profile or the
 * server setting, so there is no "Bawaan" here: `null` means the server sets no limit, and
 * `undefined` is an API that does not report it yet. What counts mirrors sakala-api's
 * `PilotRuntimeLimitService::checkBuildRateLimit()`, like the admin form's hint.
 */
export function workspaceBuildsPerHourSummary(limits: Pick<PilotLimits, 'quotas'>): string | null {
	const perHour = limits.quotas.max_builds_per_hour;
	if (perHour === undefined) return null;
	if (perHour === null) return `${BUILDS_PER_HOUR_LABEL}: tidak dibatasi.`;
	return `${BUILDS_PER_HOUR_LABEL}: paling banyak ${count.format(perHour)} deployment yang membangun image dalam 60 menit terakhir, termasuk yang gagal. Redeploy yang memakai ulang image tidak dihitung.`;
}

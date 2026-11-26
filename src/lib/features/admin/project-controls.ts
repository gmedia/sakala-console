import type { AdminProject, ProjectControlAction } from '$lib/api/resources/admin/projects';

/** The button and the history table name each action the same way. */
export const CONTROL_LABELS: Record<ProjectControlAction, string> = {
	stop: 'Hentikan',
	suspend: 'Tangguhkan',
	unsuspend: 'Buka penangguhan',
	reconcile: 'Rekonsiliasi'
};

/**
 * Stopping and suspending take the project off the air, so they sit in the page's danger zone;
 * reconciling and lifting a suspension sit beside "Muat ulang" in the header.
 */
export const DANGER_CONTROLS: readonly ProjectControlAction[] = ['stop', 'suspend'];

/** The danger zone's one sentence; each dialog says the rest. */
export const DANGER_CONTROLS_BODY =
	'Hentikan mematikan URL publiknya; tangguhkan juga menolak deploy sampai dibuka.';

/** Why stop and reconcile are missing from a project that serves nothing. */
export const NOT_SERVING_NOTE =
	'Hentikan dan rekonsiliasi butuh deployment yang sedang melayani; proyek ini tidak punya.';

/** A suspended project can only be unsuspended; stop and reconcile need a serving deployment. */
export function availableControls(
	project: Pick<AdminProject, 'status' | 'active_deployment_id'>
): ProjectControlAction[] {
	if (project.status === 'suspended') return ['unsuspend'];
	return [
		...(project.active_deployment_id !== null ? (['reconcile', 'stop'] as const) : []),
		'suspend'
	];
}

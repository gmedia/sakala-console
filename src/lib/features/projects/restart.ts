import {
	ApiError,
	getErrorMessage,
	PROJECT_NOT_RUNNING,
	PROJECT_RUNTIME_BUSY,
	PROJECT_SUSPENDED
} from '$lib/api/errors';
import type { components } from '$lib/api/generated/schema';
import type { Project } from './type';

type ProjectRestartState = components['schemas']['ProjectRestartState'];

/** The API restarts only a project that runs or crash-loops; anything else is refused. */
export const RESTARTABLE_RUNTIME_STATUSES: readonly string[] = ['running', 'crashed'];

export const RESTART_COPY = {
	action: 'Restart',
	description: 'Menyalakan ulang container tanpa build ulang. Kode dan variabel tidak berubah.',
	title: 'Restart aplikasi?',
	confirm: 'Restart',
	cancel: 'Batal',
	crashedNote:
		'Kalau crash-nya berasal dari kode, aplikasi bisa crash lagi setelah restart. Log deployment yang sedang melayani menunjukkan penyebabnya.',
	pending: 'Sedang restart',
	requested:
		'Restart diminta. Container dinyalakan ulang tanpa build, biasanya dalam beberapa detik.',
	done: 'Restart selesai. Container sudah dinyalakan ulang.',
	failed: 'Restart belum berhasil dijalankan. Muat ulang halaman, lalu tekan Restart lagi.',
	failedOnNode:
		'Server Sakala tidak berhasil menyalakan ulang container. Status di atas menunjukkan yang berjalan sekarang. Coba Restart lagi, atau Redeploy kalau masih gagal.',
	notRunning:
		'Aplikasi sedang tidak berjalan, jadi tidak ada yang bisa di-restart. Redeploy untuk menyalakannya lagi.',
	busy: 'Deployment atau restart lain masih berjalan. Tunggu sampai selesai, lalu coba lagi.',
	suspended: 'Proyek ini ditangguhkan admin Sakala, jadi belum bisa di-restart.'
} as const;

type RestartProject = Pick<Project, 'runtime_status' | 'status'> &
	Partial<Pick<Project, 'restart' | 'active_deployment_id'>>;

/** A restart is waiting for its node. An API from before user restart never says so. */
export function isRestartPending(project: Partial<Pick<Project, 'restart'>>): boolean {
	return project.restart != null;
}

/** Whether Restart is offered: something runs or crash-loops, and no restart is open yet. */
export function canRestart(project: RestartProject): boolean {
	return (
		project.status !== 'suspended' &&
		RESTARTABLE_RUNTIME_STATUSES.includes(project.runtime_status) &&
		!isRestartPending(project)
	);
}

/** What to say when a restart is refused, read by `code`. */
export function getRestartErrorMessage(error: unknown): string {
	if (error instanceof ApiError) {
		if (error.code === PROJECT_NOT_RUNNING) return RESTART_COPY.notRunning;
		if (error.code === PROJECT_RUNTIME_BUSY) return RESTART_COPY.busy;
		if (error.code === PROJECT_SUSPENDED) return RESTART_COPY.suspended;
	}
	return getErrorMessage(error, RESTART_COPY.failed);
}

/** How a member's restart ended, as the `deployment.updated` broadcast says (`restart.outcome`). */
export const RESTART_OUTCOMES = {
	succeeded: 'succeeded',
	failed: 'failed'
} as const satisfies Record<string, ProjectRestartState>;
export type RestartOutcome = {
	commandId: string;
	outcome: (typeof RESTART_OUTCOMES)[keyof typeof RESTART_OUTCOMES];
};

/**
 * The end of a restart, from a `deployment.updated` payload, or null for any other update. Only the
 * broadcast says how it ended: the project's `restart` goes back to null either way.
 */
export function parseRestartOutcome(payload: unknown): RestartOutcome | null {
	if (typeof payload !== 'object' || payload === null) return null;
	const restart = (payload as { restart?: unknown }).restart;
	if (typeof restart !== 'object' || restart === null) return null;
	const { command_id: commandId, outcome } = restart as Record<string, unknown>;
	if (typeof commandId !== 'string') return null;
	if (outcome !== RESTART_OUTCOMES.succeeded && outcome !== RESTART_OUTCOMES.failed) return null;
	return { commandId, outcome };
}

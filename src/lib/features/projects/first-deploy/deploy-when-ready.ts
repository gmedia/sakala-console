import type { DeployWhenReady, Project } from '../type';

/**
 * The first deployment the API starts once a database made for the project is ready
 * (`databases[0].deploy_when_ready`, wizard env + database contract).
 */
export const DEPLOY_WHEN_READY_STATUSES = {
	waiting: 'waiting',
	started: 'started',
	skipped: 'skipped'
} as const;

export const PROVISIONING_FAILED_REASON = 'database_provisioning_failed';

export type DeployWhenReadyView =
	| { kind: 'waiting' }
	| { kind: 'started'; deploymentId: string }
	| { kind: 'skipped'; reason: string; provisioningFailed: boolean };

/**
 * Same reasons as the redeploy after a password rotation (DatabaseRedeploySkipReason in
 * sakala-api), written for a first deploy, plus a database that could not be made.
 */
const SKIPPED_REASONS: Record<string, string> = {
	[PROVISIONING_FAILED_REASON]: 'Database gagal dibuat, jadi deploy tidak dimulai.',
	requester_cannot_deploy:
		'Deploy tidak dimulai karena akunmu tidak lagi bisa men-deploy proyek ini.',
	legal_acceptance_required: 'Deploy tidak dimulai karena syarat layanan terbaru belum disetujui.',
	project_suspended: 'Deploy tidak dimulai karena proyek ini ditangguhkan.',
	active_deployment_limit:
		'Deploy tidak dimulai karena masih ada deployment lain yang berjalan. Coba lagi setelah selesai.',
	active_container_limit: 'Deploy tidak dimulai karena batas aplikasi aktif workspace sudah penuh.',
	build_rate_limit: 'Deploy tidak dimulai karena batas build per jam sudah tercapai.',
	repository_access_revoked:
		'Deploy tidak dimulai karena akses ke repository GitHub-nya sudah dicabut.',
	database_endpoint_unavailable:
		'Deploy tidak dimulai karena server database belum melaporkan alamatnya.',
	release_command_unsupported:
		'Deploy tidak dimulai karena servernya belum bisa menjalankan release command.'
};

const SKIPPED_FALLBACK = 'Deploy otomatis belum bisa dimulai untuk proyek ini.';

export function deployWhenReadySkippedText(reason: string | null): string {
	return (reason && SKIPPED_REASONS[reason]) || SKIPPED_FALLBACK;
}

/** The request of the project's database, if it has one. */
export function deployWhenReadyOf(
	project: Pick<Project, 'databases'> | undefined
): DeployWhenReady | null {
	return project?.databases?.[0]?.deploy_when_ready ?? null;
}

/**
 * What the wizard shows for the request. A status from a newer API reads as still waiting: the
 * page keeps polling rather than claiming an outcome it cannot name.
 */
export function deployWhenReadyView(request: DeployWhenReady | null): DeployWhenReadyView | null {
	if (!request) return null;
	if (request.status === DEPLOY_WHEN_READY_STATUSES.started && request.deployment_id) {
		return { kind: 'started', deploymentId: request.deployment_id };
	}
	if (request.status === DEPLOY_WHEN_READY_STATUSES.skipped) {
		return {
			kind: 'skipped',
			reason: deployWhenReadySkippedText(request.skipped_reason),
			provisioningFailed: request.skipped_reason === PROVISIONING_FAILED_REASON
		};
	}
	return { kind: 'waiting' };
}

/** Polled while the page waits for the database, a little faster than inspection. */
export function isWaitingForDatabase(project: Pick<Project, 'databases'> | undefined): boolean {
	return deployWhenReadyView(deployWhenReadyOf(project))?.kind === 'waiting';
}

export const WAITING_COPY = {
	title: 'Menyiapkan database',
	body: 'Database sedang dibuat, biasanya dalam beberapa detik. Deploy dimulai otomatis setelah siap, dan halaman ini boleh ditinggal.',
	slow: 'Masih menunggu server database. Ini belum berarti gagal; kalau gagal, halaman ini menjelaskan apa yang terjadi.',
	deployStep: 'Deploy pertama dimulai',
	skippedTitle: 'Deploy belum dimulai',
	withoutDatabase: 'Deploy tanpa database',
	retryDeploy: 'Deploy sekarang',
	openDatabase: 'Buka database'
} as const;

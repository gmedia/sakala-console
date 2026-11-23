import { ApiError, DEPLOYMENT_NOT_ROLLBACK_TARGET, PROJECT_SUSPENDED } from '$lib/api/errors';
import type { components } from '$lib/api/generated/schema';
import { getDeployErrorMessage } from '$lib/features/projects/presentation';

type GeneratedDeployment = components['schemas']['DeploymentResource'];
type GeneratedProject = components['schemas']['ProjectResource'];

/** Why the API refused a rollback target (`reason` of DEPLOYMENT_NOT_ROLLBACK_TARGET). */
export const ROLLBACK_REFUSAL_REASONS = {
	notSucceeded: 'not_succeeded',
	alreadyActive: 'already_active',
	noCommit: 'no_commit',
	branchChanged: 'branch_changed',
	/** The target has no recorded settings; `rollback_target` does not check this beforehand. */
	settingsUnavailable: 'settings_unavailable'
} as const;
export type RollbackRefusalReason =
	(typeof ROLLBACK_REFUSAL_REASONS)[keyof typeof ROLLBACK_REFUSAL_REASONS];

const SHORT_SHA = 7;

export const ROLLBACK_COPY = {
	action: 'Kembalikan ke versi ini',
	rowMenuLabel: (sequence: number) => `Pilihan untuk deployment #${sequence}`,
	title: (sequence: number) => `Kembalikan ke deployment #${sequence}?`,
	confirm: (sequence: number) => `Kembalikan ke #${sequence}`,
	cancel: 'Batal',
	currentLabel: 'Sedang melayani',
	targetLabel: 'Kembali ke',
	noneServing: 'Belum ada versi yang melayani',
	withoutCommit: 'Tanpa commit',
	manualMessage: 'Deployment manual',
	settings: (sequence: number) =>
		`Kode dan perintah build serta start diambil dari #${sequence}. Environment variable tetap yang sekarang, bukan yang dipakai saat itu.`,
	imageKept: 'Image versi ini masih tersimpan, jadi tidak perlu build.',
	imageRebuilt:
		'Image versi ini sudah tidak tersimpan, jadi Sakala akan build ulang commit ini (lebih lama).',
	autoDeployPaused:
		'Auto-deploy dijeda sampai dinyalakan lagi, supaya push berikutnya tidak langsung menimpa versi ini. Push yang masuk tetap tercatat di Riwayat.',
	started: (sequence: number) => `Rollback ke #${sequence} dimulai.`,
	failed:
		'Rollback belum berhasil dijalankan. Muat ulang halaman, lalu jalankan rollback-nya lagi.',
	suspended: 'Proyek ini ditangguhkan admin Sakala, jadi belum bisa di-rollback.',
	refused: {
		not_succeeded: (sequence: number) =>
			`Deployment #${sequence} tidak berhasil, jadi tidak bisa dipakai untuk rollback.`,
		already_active: (sequence: number) =>
			`Deployment #${sequence} sedang melayani sekarang, jadi tidak perlu dikembalikan.`,
		no_commit: (sequence: number) =>
			`Deployment #${sequence} tidak mencatat commit, jadi Sakala tidak tahu kode mana yang harus dikembalikan.`,
		branch_changed: (sequence: number) =>
			`Deployment #${sequence} dari branch lain. Rollback hanya ke deployment dari branch yang dipakai proyek sekarang.`,
		settings_unavailable: (sequence: number) =>
			`Pengaturan build yang dipakai deployment #${sequence} tidak tercatat, jadi versi ini tidak bisa dikembalikan. Kembalikan commit-nya di repository, lalu Redeploy.`
	} satisfies Record<RollbackRefusalReason, (sequence: number) => string>,
	/** A refusal whose reason this Console does not know. */
	refusedOther: (sequence: number) =>
		`Deployment #${sequence} sudah tidak bisa dipakai untuk rollback. Riwayat dimuat ulang.`
} as const;

type VersionDeployment = Pick<
	GeneratedDeployment,
	'id' | 'sequence' | 'commit_sha' | 'commit_message'
> & { rollback_target?: GeneratedDeployment['rollback_target'] };

/** One side of the comparison: what serves now, or what comes back. */
export type RollbackVersion = {
	id: string;
	sequence: number;
	shortSha: string | null;
	message: string;
};

export type RollbackPlan = {
	target: RollbackVersion;
	/** Null when nothing serves now, or the serving deployment has not loaded. */
	current: RollbackVersion | null;
	/** True when the node still holds the image: no build. */
	imageKept: boolean;
	/** True when this rollback leaves auto-deploy paused. */
	pausesAutoDeploy: boolean;
	notes: string[];
};

function toVersion(deployment: VersionDeployment): RollbackVersion {
	return {
		id: deployment.id,
		sequence: deployment.sequence,
		shortSha: deployment.commit_sha ? deployment.commit_sha.substring(0, SHORT_SHA) : null,
		message: deployment.commit_message || ROLLBACK_COPY.manualMessage
	};
}

/**
 * What the confirmation says. Auto-deploy pauses when it is on now, and stays paused when an earlier
 * rollback paused it; a project that never had it on is left alone.
 */
export function getRollbackPlan(
	target: VersionDeployment,
	current: VersionDeployment | null | undefined,
	project: Pick<GeneratedProject, 'auto_deploy'> & {
		auto_deploy_pause?: GeneratedProject['auto_deploy_pause'];
	}
): RollbackPlan {
	const imageKept = target.rollback_target?.image_expected === true;
	const pausesAutoDeploy = project.auto_deploy || project.auto_deploy_pause != null;
	const notes = [
		ROLLBACK_COPY.settings(target.sequence),
		imageKept ? ROLLBACK_COPY.imageKept : ROLLBACK_COPY.imageRebuilt
	];
	if (pausesAutoDeploy) notes.push(ROLLBACK_COPY.autoDeployPaused);

	return {
		target: toVersion(target),
		current: current ? toVersion(current) : null,
		imageKept,
		pausesAutoDeploy,
		notes
	};
}

function refusalReason(details: Record<string, unknown>): RollbackRefusalReason | null {
	const reason = details.reason;
	return Object.values(ROLLBACK_REFUSAL_REASONS).includes(reason as RollbackRefusalReason)
		? (reason as RollbackRefusalReason)
		: null;
}

/** Whether the refusal means the history on screen is out of date, so it should be read again. */
export function isStaleRollbackTarget(error: unknown): boolean {
	return error instanceof ApiError && error.code === DEPLOYMENT_NOT_ROLLBACK_TARGET;
}

/**
 * What to say when a rollback is refused, read by `code`. The deploy refusals (replicas, release
 * command, container limit) read as they do for Redeploy.
 */
export function getRollbackErrorMessage(error: unknown, targetSequence: number): string {
	if (error instanceof ApiError) {
		if (error.code === DEPLOYMENT_NOT_ROLLBACK_TARGET) {
			const reason = refusalReason(error.details);
			return reason
				? ROLLBACK_COPY.refused[reason](targetSequence)
				: ROLLBACK_COPY.refusedOther(targetSequence);
		}
		if (error.code === PROJECT_SUSPENDED) return ROLLBACK_COPY.suspended;
	}
	return getDeployErrorMessage(error, ROLLBACK_COPY.failed);
}

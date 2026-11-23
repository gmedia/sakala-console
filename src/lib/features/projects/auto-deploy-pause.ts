import type { AutoDeployPause } from './type';

export const AUTO_DEPLOY_PAUSE_COPY = {
	titleWithTarget: (sequence: number) => `Auto-deploy dijeda setelah rollback ke #${sequence}`,
	title: 'Auto-deploy dijeda setelah rollback',
	consequence: (branch: string) =>
		`Push ke ${branch} dicatat di Riwayat, tetapi tidak di-deploy, supaya versi rollback tidak tertimpa.`,
	held: (count: number) => `${count} push sudah ditahan.`,
	resumeHint: (branch: string) =>
		`Menyalakannya lagi tidak langsung men-deploy apa pun. Push berikutnya ke ${branch} yang akan di-deploy.`,
	resume: 'Nyalakan lagi auto-deploy',
	resuming: 'Menyalakan...',
	resumed: (branch: string) =>
		`Auto-deploy menyala lagi. Push berikutnya ke ${branch} langsung di-deploy.`,
	resumeFailed: 'Auto-deploy belum berhasil dinyalakan lagi. Silakan coba lagi.',
	askOwner: (workspace: string) =>
		`Pemilik atau anggota workspace ${workspace} bisa menyalakannya lagi.`,
	rollbackLink: (sequence: number) => `Lihat deployment #${sequence}`
} as const;

export type AutoDeployPauseNotice = {
	title: string;
	consequence: string;
	held: string | null;
	resumeHint: string;
};

/**
 * The banner's words. The pause carries the rollback deployment, not the version it went back to,
 * so `targetSequence` comes from that deployment when the history has it.
 */
export function describeAutoDeployPause(
	pause: Pick<AutoDeployPause, 'held_push_count'>,
	options: { branch: string; targetSequence: number | null | undefined }
): AutoDeployPauseNotice {
	return {
		title:
			options.targetSequence == null
				? AUTO_DEPLOY_PAUSE_COPY.title
				: AUTO_DEPLOY_PAUSE_COPY.titleWithTarget(options.targetSequence),
		consequence: AUTO_DEPLOY_PAUSE_COPY.consequence(options.branch),
		held: pause.held_push_count > 0 ? AUTO_DEPLOY_PAUSE_COPY.held(pause.held_push_count) : null,
		resumeHint: AUTO_DEPLOY_PAUSE_COPY.resumeHint(options.branch)
	};
}

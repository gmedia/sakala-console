import type { Deployment, SkippedPush, SkippedPushReason } from './type';

/** Why a push did not deploy (`reason` of a skipped push). */
export const SKIPPED_PUSH_REASONS = {
	noChangesInRootDirectory: 'no_changes_in_root_directory',
	autoDeployPaused: 'auto_deploy_paused'
} as const satisfies Record<string, SkippedPushReason>;

export const SKIPPED_PUSH_COPY = {
	skippedStatus: 'Dilewati',
	heldStatus: 'Ditahan',
	skippedQuestion: 'Kenapa push ini dilewati?',
	heldQuestion: 'Kenapa push ini tidak di-deploy?',
	heldTitle: 'Ditahan — auto-deploy sedang dijeda',
	heldReason: (sha: string) =>
		`Push ini (commit ${sha}) tidak di-deploy karena auto-deploy sedang dijeda setelah rollback, supaya versi rollback tidak tertimpa.`,
	heldNext: (branch: string) =>
		`Redeploy men-deploy commit terbaru di ${branch}. Kalau auto-deploy dinyalakan lagi, push berikutnya langsung di-deploy; push yang sudah ditahan tidak di-deploy sendiri.`,
	heldFiles: (count: number) => `${count} file berubah:`
} as const;

export function isHeldPush(skip: Pick<SkippedPush, 'reason'>): boolean {
	return skip.reason === SKIPPED_PUSH_REASONS.autoDeployPaused;
}

/** The API's page cap; one history page of six deployments rarely has more skipped pushes behind it. */
export const SKIPPED_PUSHES_PER_PAGE = 100;

/**
 * `since` for the skipped pushes of one history page: the oldest deployment shown. A push is skipped
 * after the deployment it follows, so every skip that belongs on this page is at or after it.
 * Undefined when there is nothing to attach skips to.
 */
export function skippedPushesSince(
	deployments: Pick<Deployment, 'created_at'>[]
): string | undefined {
	let oldest: string | undefined;
	let oldestTime = Infinity;

	for (const { created_at } of deployments) {
		const time = Date.parse(created_at);
		if (Number.isFinite(time) && time < oldestTime) {
			oldestTime = time;
			oldest = created_at;
		}
	}

	return oldest;
}

/**
 * Skipped pushes per deployment they followed, newest first as the API sends them. Skips that follow a
 * deployment on another page are left out; that page shows them.
 */
export function groupSkippedPushes(
	deployments: Pick<Deployment, 'id'>[],
	skips: SkippedPush[]
): Map<string, SkippedPush[]> {
	const shown = new Set(deployments.map((deployment) => deployment.id));
	const groups = new Map<string, SkippedPush[]>();

	for (const skip of skips) {
		if (!shown.has(skip.after_deployment_id)) continue;
		const group = groups.get(skip.after_deployment_id) ?? [];
		group.push(skip);
		groups.set(skip.after_deployment_id, group);
	}

	return groups;
}

export function skippedPushTitle(skip: Pick<SkippedPush, 'root_directory' | 'reason'>): string {
	if (isHeldPush(skip)) return SKIPPED_PUSH_COPY.heldTitle;
	return `Dilewati — tidak ada perubahan di ${skip.root_directory}`;
}

/** "3 file berubah" plus the files the API sent; the rest is a count, never invented. */
export function skippedPushFiles(
	skip: Pick<SkippedPush, 'changed_path_count' | 'example_paths' | 'reason'>
): {
	summary: string;
	paths: string[];
	more: string | null;
} {
	const rest = skip.changed_path_count - skip.example_paths.length;

	return {
		summary: isHeldPush(skip)
			? SKIPPED_PUSH_COPY.heldFiles(skip.changed_path_count)
			: `${skip.changed_path_count} file berubah, semuanya di folder proyek lain:`,
		paths: skip.example_paths,
		more: rest > 0 ? `dan ${rest} file lainnya` : null
	};
}

export function shortSha(sha: string): string {
	return sha.substring(0, 7);
}

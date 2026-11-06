import { ApiError, NetworkError } from '$lib/api/errors';
import { formatClockTime, formatDateTime, formatDuration } from '$lib/utils/date';
import type { Deployment, DeploymentEvent } from '$lib/api/resources/deployment';
import { sortUniqueEvents } from './deployment-normalization';
import type { DeploymentStep } from './type';

const triggerLabels: Record<string, string> = {
	manual: 'Manual',
	redeploy: 'Manual redeploy',
	webhook: 'Auto-deploy dari push',
	system: 'System'
};

export const TERMINAL_STATUSES = new Set(['succeeded', 'failed', 'cancelled']);

export type LifecycleTimestamps = {
	created_at?: string | null;
	started_at?: string | null;
	finished_at?: string | null;
	cancelled_at?: string | null;
};

export type DeploymentErrorConfig = {
	title: string;
	description: string;
	showRetry: boolean;
};

export function getDeploymentErrorConfig(error: unknown): DeploymentErrorConfig {
	if (error instanceof NetworkError) {
		return {
			title: 'Koneksi terputus',
			description:
				'Gagal memuat status terbaru. Pastikan koneksi internetmu stabil untuk melihat proses deployment.',
			showRetry: true
		};
	}
	if (error instanceof ApiError) {
		if (error.status === 404) {
			return {
				title: 'Deployment tidak ditemukan',
				description:
					'Detail deployment ini tidak tersedia. Prosesnya mungkin sudah dibatalkan atau dihapus.',
				showRetry: false
			};
		}
		if (error.isForbidden) {
			return {
				title: 'Tidak memiliki akses',
				description: 'Kamu tidak memiliki akses untuk melihat deployment ini.',
				showRetry: false
			};
		}
		if (error.isServerError) {
			return {
				title: 'Server sedang bermasalah',
				description:
					'Terjadi masalah pada server saat mengambil data deployment. Silakan coba lagi. ',
				showRetry: true
			};
		}
	}
	return {
		title: 'Gagal memuat detail deployment',
		description:
			'Terjadi kendala saat mengambil data dari server. Ini bukan karena data deployment kamu hilang, coba muat ulang halamannya.',
		showRetry: true
	};
}

/**
 * True only when this is provably the first deployment of the project to succeed. `recent` holds the
 * newest few, so with an older history out of reach this says false, and the page stays calm.
 */
export function isFirstSuccessfulDeployment(
	current: Pick<Deployment, 'sequence' | 'status'>,
	recent: readonly Pick<Deployment, 'sequence' | 'status'>[]
): boolean {
	if (current.status !== 'succeeded') return false;
	if (current.sequence === 1) return true;

	const earlier = recent.filter((deployment) => deployment.sequence < current.sequence);
	return (
		earlier.some((deployment) => deployment.sequence === 1) &&
		earlier.every((deployment) => deployment.status !== 'succeeded')
	);
}

/** Only GitHub's commit address is known here, so any other host gets no link rather than a guess. */
export function getCommitUrl(
	repositoryUrl: string | null | undefined,
	commitSha: string | null | undefined
): string | null {
	if (!repositoryUrl || !commitSha) return null;
	try {
		const url = new URL(repositoryUrl);
		if (url.protocol !== 'https:' || url.hostname !== 'github.com') return null;
		return `${url.origin}${url.pathname.replace(/\.git$/, '').replace(/\/$/, '')}/commit/${encodeURIComponent(commitSha)}`;
	} catch {
		return null;
	}
}

export function getDeploymentTriggerLabel(trigger: string): string {
	return triggerLabels[trigger] ?? trigger;
}

export function deriveCurrentStepLabel(steps: DeploymentStep[]): string | undefined {
	return steps.find((step) => step.status === 'running')?.title;
}

export function deriveFailedStepLabel(steps: DeploymentStep[]): string | undefined {
	return steps.find((step) => step.status === 'failed')?.title;
}

export function deriveDurationLabel(
	startedAt: string | null,
	finishedAt: string | null
): string | undefined {
	if (!startedAt || !finishedAt) return undefined;
	const durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
	return formatDuration(Math.round(durationMs / 1000));
}

/** What the deployment ran with, or was going to, for reading a resource failure against. */
export function formatResourceLimit(
	deployment: Pick<Deployment, 'applied_resources' | 'effective_resources'>
): string | null {
	const limits = deployment.applied_resources ?? deployment.effective_resources?.resources;
	if (!limits) return null;

	const parts: string[] = [];
	if (limits.memory_mb) parts.push(`${limits.memory_mb} MB memori`);
	if (limits.cpu_millis) {
		const cores = (limits.cpu_millis / 1000).toLocaleString('id-ID');
		parts.push(`${cores} CPU`);
	}
	return parts.length > 0 ? parts.join(', ') : null;
}

export function deriveLastUpdateTimestamp(
	events: DeploymentEvent[],
	lifecycle?: LifecycleTimestamps
): string {
	const sorted = sortUniqueEvents(events);
	const latest = sorted.at(-1);
	if (latest?.occurred_at) {
		return formatDeploymentTime(latest.occurred_at);
	}

	const fallback =
		lifecycle?.finished_at ??
		lifecycle?.cancelled_at ??
		lifecycle?.started_at ??
		lifecycle?.created_at;

	return fallback ? formatDeploymentTime(fallback) : '-';
}

/** A time on a deployment: the clock today, with the date in front when it is from another day. */
export function formatDeploymentTime(iso: string | null | undefined, now = new Date()): string {
	return iso ? formatDateTime(iso, now) : '-';
}

/** A log line's time. The panel names the day already, so every line would repeat it. */
export function formatLogTime(iso: string | null | undefined): string {
	return iso ? formatClockTime(iso) : '-';
}

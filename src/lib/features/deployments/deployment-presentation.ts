import { ApiError, NetworkError } from '$lib/api/errors';
import type { DeploymentEvent } from '$lib/api/resources/deployment';
import { sortUniqueEvents } from './deployment-normalization';
import type { DeploymentStep } from './type';

const triggerLabels: Record<string, string> = {
	manual: 'Manual',
	redeploy: 'Manual redeploy',
	webhook: 'Push',
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
	const durationSeconds = Math.round(durationMs / 1000);
	return `${durationSeconds} detik`;
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

export function formatDeploymentTime(iso: string | null | undefined): string {
	if (!iso) return '-';
	return new Date(iso).toLocaleTimeString('id-ID', {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false
	});
}

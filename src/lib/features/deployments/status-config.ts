import { formatDuration } from '$lib/utils/date';
import type { DeploymentProgress, DeploymentStage, StatusDeployment } from './type';

export type BannerStatus = Exclude<StatusDeployment, 'pending'>;

const SUPPORTED_BANNER_STATUSES = ['running', 'success', 'failed', 'cancelled'] as const;

export function isBannerStatus(value: string | null): value is BannerStatus {
	return (SUPPORTED_BANNER_STATUSES as readonly string[]).includes(value ?? '');
}

export function parseBannerStatus(
	value: string | null,
	fallback: BannerStatus = 'running'
): BannerStatus {
	return isBannerStatus(value) ? value : fallback;
}

const bannerStatusMap: Record<DeploymentStage, BannerStatus> = {
	Queued: 'running',
	Cloning: 'running',
	Analyzing: 'running',
	Building: 'running',
	Deploying: 'running',
	HealthChecking: 'running',
	Routing: 'running',
	Succeeded: 'success',
	Failed: 'failed',
	Cancelled: 'cancelled'
};

export function getBannerStatus(stage: DeploymentStage): BannerStatus {
	return bannerStatusMap[stage];
}

const deploymentStageLabel: Record<DeploymentStage, string> = {
	Queued: 'Menunggu antrean',
	Cloning: 'Menyalin repository',
	Analyzing: 'Menganalisis proyek',
	Building: 'Build proyek',
	Deploying: 'Deploy proyek',
	HealthChecking: 'Mengecek aplikasi',
	Routing: 'Menyiapkan routing',
	Succeeded: 'Berhasil',
	Failed: 'Gagal',
	Cancelled: 'Dibatalkan'
};

export function getDeploymentStageLabel(stage: DeploymentStage): string {
	return deploymentStageLabel[stage];
}

/** Whether a succeeded deployment is what the public URL serves right now. */
export type ServingState = 'live' | 'unconfirmed' | 'superseded' | 'not_serving' | 'crash_looping';

export type QueueState = 'assigned' | 'waiting_for_node';

export interface StatusDisplayInput {
	status: BannerStatus;
	currentStepLabel?: string;
	durationLabel?: string;
	failedStepLabel?: string;
	failureCategory?: string;
	failureCode?: string;
	failureSummary?: string;
	failureDetail?: string;
	userFixable?: boolean;
	recoveryHint?: string;
	servingState?: ServingState;
	queueState?: QueueState | null;
	cancelRequested?: boolean;
}

export interface TimelineItemDisplayInput {
	status: StatusDeployment;
	title: string;
	timestamp?: string;
	showSubtitle?: boolean;
}

export interface TimelineItemDisplay {
	title: string;
	subtitle?: string;
}

export function getTimelineItemDisplay({
	status,
	title,
	timestamp,
	showSubtitle = true
}: TimelineItemDisplayInput): TimelineItemDisplay {
	const displayTitle = titleForStatus(status, title);

	if (!showSubtitle) {
		return { title: displayTitle };
	}

	switch (status) {
		case 'pending':
			return { title: displayTitle };
		case 'running':
			return { title: displayTitle, subtitle: 'Sedang berjalan...' };
		case 'success':
			return { title: displayTitle, subtitle: timestamp };
		case 'failed':
		case 'cancelled':
			return { title: displayTitle, subtitle: timestamp };
	}
}

function titleForStatus(status: StatusDeployment, title: string): string {
	if (status === 'failed') return `${title} - gagal`;
	if (status === 'cancelled') return `${title} - dibatalkan`;
	return title;
}

const bannerIconColorMap: Partial<Record<BannerStatus, string>> = {
	running: 'bg-primary text-white'
};

const bannerBgMap: Record<BannerStatus, string> = {
	running: 'bg-primary-50',
	success: 'bg-success-soft',
	failed: 'bg-error/10',
	cancelled: 'bg-muted/10'
};

const timeLabelMap: Record<BannerStatus, string> = {
	running: 'Dimulai pada',
	success: 'Selesai pada',
	failed: 'Gagal pada',
	cancelled: 'Dibatalkan pada'
};

export interface LiveInfoTimestampInput {
	status: BannerStatus;
	startedAtLabel: string;
	finishedAtLabel?: string;
}
export function deriveLiveInfoTimestamp({
	status,
	startedAtLabel,
	finishedAtLabel
}: LiveInfoTimestampInput): string {
	if (status === 'running') return startedAtLabel;
	return finishedAtLabel ?? '-';
}

/** Keyed by `DeploymentFailureCategory` in sakala-api; anything else falls back to the plain title. */
const failureHeadlines: Record<string, string> = {
	checkout: 'Deployment gagal saat mengambil source code',
	build: 'Deployment gagal saat build',
	start: 'Deployment gagal saat menjalankan aplikasi',
	health: 'Deployment gagal saat pengecekan aplikasi',
	route: 'Deployment gagal saat menyiapkan alamat publik',
	timeout: 'Deployment melewati batas waktu',
	resource: 'Deployment gagal karena batas resource',
	node: 'Deployment gagal karena server Sakala belum siap',
	scheduling: 'Deployment gagal karena belum ada server yang tersedia'
};

export function getFailureHeadline(category?: string): string {
	return (category && failureHeadlines[category]) || 'Deployment gagal';
}

/**
 * `user_fixable: false` means the API does not put this on the user's code. An `unknown` failure
 * carries the same flag, but nobody knows the cause yet, so it does not claim the platform either.
 */
function isPlatformFailure(category?: string, userFixable?: boolean): boolean {
	return userFixable === false && category !== 'unknown';
}

function getFailureDescription(
	failedStepLabel?: string,
	category?: string,
	userFixable?: boolean
): string {
	if (isPlatformFailure(category, userFixable)) {
		const where = failedStepLabel ? `Berhenti di tahap ${failedStepLabel}. ` : '';
		return `${where}Ini kendala di sisi platform Sakala, bukan dari kode kamu.`;
	}

	return failedStepLabel
		? `Berhenti di tahap ${failedStepLabel}, lihat log di bawah untuk detail error`
		: 'Penyebabnya belum bisa dipastikan. Lihat log di bawah untuk detailnya.';
}

function getSuccessDescription(
	durationLabel?: string,
	servingState: ServingState = 'live'
): string {
	const duration = `Selesai dalam ${durationLabel ?? '-'}`;

	switch (servingState) {
		case 'live':
			return `${duration}, perubahan sudah live`;
		case 'unconfirmed':
			return `${duration}. Sedang memastikan apakah aplikasinya sudah melayani.`;
		case 'superseded':
			return `${duration}. Deployment ini sudah digantikan oleh deployment yang lebih baru.`;
		case 'not_serving':
			return `${duration}. Aplikasinya sedang tidak melayani, lihat status di bagian atas halaman.`;
		case 'crash_looping':
			return `${duration}. Aplikasinya terus berhenti dan dimulai ulang, lihat status di bagian atas halaman.`;
	}
}

function getRunningMessage(
	currentStepLabel?: string,
	queueState?: QueueState | null,
	cancelRequested?: boolean
): { title: string; desc: string } {
	if (cancelRequested) {
		return {
			title: 'Deployment sedang dibatalkan',
			desc: 'Permintaan batal sudah terkirim. Server perlu menghentikan prosesnya dulu, jadi statusnya berubah setelah itu selesai.'
		};
	}
	if (queueState === 'waiting_for_node') {
		return {
			title: 'Deployment mengantre',
			desc: 'Belum ada server Sakala yang siap menjalankannya. Deployment ini tetap mengantre sampai ada server yang siap, dan kamu bisa membatalkannya kalau tidak mau menunggu.'
		};
	}
	if (queueState === 'assigned') {
		return {
			title: 'Deployment mengantre',
			desc: 'Server sudah siap. Prosesnya mulai begitu server mengambil deployment ini.'
		};
	}
	return {
		title: 'Deployment sedang berjalan',
		desc: `Tahap: ${currentStepLabel ?? '-'}. Kamu dapat meninggalkan halaman ini dan kembali lagi nanti untuk melihat progresnya.`
	};
}

export function getStatusDisplay({
	status,
	currentStepLabel,
	durationLabel,
	failedStepLabel,
	failureCategory,
	userFixable,
	recoveryHint,
	servingState,
	queueState,
	cancelRequested
}: StatusDisplayInput) {
	const isQueued = status === 'running' && Boolean(queueState) && !cancelRequested;
	const messages = {
		running: getRunningMessage(currentStepLabel, queueState, cancelRequested),
		success: {
			title: 'Deployment berhasil',
			desc: getSuccessDescription(durationLabel, servingState)
		},
		failed: {
			title: getFailureHeadline(failureCategory),
			desc: getFailureDescription(failedStepLabel, failureCategory, userFixable)
		},
		cancelled: {
			title: 'Deployment dibatalkan',
			desc: 'Deployment ini dihentikan sebelum selesai.'
		}
	} as const;

	return {
		...messages[status],
		recoveryHint: status === 'failed' ? recoveryHint : undefined,
		// Running is healthy, so teal. Waiting in a queue is the one state that may need a look.
		bannerBgClass: isQueued ? 'bg-queued-soft' : bannerBgMap[status],
		iconColorClass: isQueued ? 'bg-queued text-white' : bannerIconColorMap[status]
	};
}

/** Stage names as the API sends them in `status` and `failure.stage`. */
const statusStages: Record<string, DeploymentStage> = {
	queued: 'Queued',
	cloning: 'Cloning',
	analyzing: 'Analyzing',
	building: 'Building',
	deploying: 'Deploying',
	health_checking: 'HealthChecking',
	routing: 'Routing',
	succeeded: 'Succeeded',
	failed: 'Failed',
	cancelled: 'Cancelled'
};

export function getStageFromStatus(status: string | null | undefined): DeploymentStage | undefined {
	return status ? statusStages[status] : undefined;
}

export function getDeploymentStatusLabel(status: string): string {
	const stage = getStageFromStatus(status);
	return stage ? getDeploymentStageLabel(stage) : status.replaceAll('_', ' ');
}

/** The hint is the API's text; only its label depends on whether the user can repair this. */
export function getRecoveryHintLabel(userFixable?: boolean): string {
	return userFixable === false ? 'Yang bisa kamu lakukan:' : 'Cara memperbaiki:';
}

export function getTimeLabel(status: BannerStatus): string {
	return timeLabelMap[status];
}

export function deriveBannerState(
	progress: DeploymentProgress,
	elapsedSeconds: number
): StatusDisplayInput {
	const status = getBannerStatus(progress.stage);

	switch (status) {
		case 'failed':
			return {
				status,
				failedStepLabel: progress.steps.find((step) => step.status === 'failed')?.title
			};

		case 'success':
			return {
				status,
				durationLabel: formatDuration(elapsedSeconds)
			};

		case 'running':
			return {
				status,
				currentStepLabel: getDeploymentStageLabel(progress.stage)
			};

		case 'cancelled':
			return { status };
	}
}

export function getBannerStatusFromDeploymentStatus(status: string): BannerStatus {
	switch (status) {
		case 'succeeded':
			return 'success';

		case 'failed':
			return 'failed';

		case 'cancelled':
			return 'cancelled';

		default:
			return 'running';
	}
}

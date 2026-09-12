import type { DeploymentProgress, DeploymentStage, DeploymentStep, StatusDeployment } from './type';

export type BannerStatus = Exclude<StatusDeployment, 'pending'>;

const SUPPORTED_BANNER_STATUSES = ['running', 'success', 'failed'] as const;

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
	Routing: 'running',
	HealthChecking: 'running',
	Succeeded: 'success',
	Failed: 'failed',
	Cancelled: 'failed'
};

export function getBannerStatus(stage: DeploymentStage): BannerStatus {
	return bannerStatusMap[stage];
}

const deploymentStageLabel: Record<DeploymentStage, string> = {
	Queued: 'Menunggu antrean',
	Cloning: 'Menyalin repository',
	Analyzing: 'Menganalisis project',
	Building: 'Build project',
	Deploying: 'Deploy project',
	Routing: 'Menyiapkan routing',
	HealthChecking: 'Memeriksa kesehatan aplikasi',
	Succeeded: 'Selesai',
	Failed: 'Gagal',
	Cancelled: 'Dibatalkan'
};

export function getDeploymentStageLabel(stage: DeploymentStage): string {
	return deploymentStageLabel[stage];
}

export interface StatusDisplayInput {
	status: BannerStatus;
	currentStepLabel?: string;
	durationLabel?: string;
	failedStepLabel?: string;
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
	const displayTitle = status === 'failed' ? `${title} - gagal` : title;

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
			return { title: displayTitle, subtitle: timestamp };
	}
}

const bannerIconColorMap: Partial<Record<BannerStatus, string>> = {
	running: 'bg-warning-dark text-white'
};

const bannerBgMap: Record<BannerStatus, string> = {
	running: 'bg-warning/10',
	success: 'bg-success-soft',
	failed: 'bg-error/10'
};

const timeLabelMap: Record<BannerStatus, string> = {
	running: 'Dimulai pada',
	success: 'Selesai pada',
	failed: 'Gagal pada'
};

export interface LiveInfoTimestampInput {
	status: BannerStatus;
	steps: DeploymentStep[];
	startedAtLabel: string;
}

export function deriveLiveInfoTimestamp({
	status,
	steps,
	startedAtLabel
}: LiveInfoTimestampInput): string {
	if (status === 'running') {
		return startedAtLabel;
	}

	if (status === 'failed') {
		const failedStep = steps.find((s) => s.status === 'failed');
		return failedStep?.timestamp ?? '-';
	}

	const lastTimestamped = [...steps].reverse().find((s) => s.timestamp);
	return lastTimestamped?.timestamp ?? '-';
}

export function getStatusDisplay({
	status,
	currentStepLabel,
	durationLabel,
	failedStepLabel
}: StatusDisplayInput) {
	const messages = {
		running: {
			title: 'Deployment sedang berjalan',
			desc: `Tahap: ${currentStepLabel ?? '-'}, perkiraan selesai dalam beberapa detik`
		},
		success: {
			title: 'Deployment berhasil',
			desc: `Selesai dalam ${durationLabel ?? '-'}, perubahan sudah live`
		},
		failed: {
			title: 'Deployment gagal',
			desc: `Berhenti di tahap ${failedStepLabel ?? '-'}, lihat log di bawah untuk detail error`
		}
	} as const;

	return {
		...messages[status],
		bannerBgClass: bannerBgMap[status],
		iconColorClass: bannerIconColorMap[status]
	};
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
				durationLabel: `${elapsedSeconds} detik`
			};

		case 'running':
			return {
				status,
				currentStepLabel: getDeploymentStageLabel(progress.stage)
			};
	}
}

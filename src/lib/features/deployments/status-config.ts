import type { StatusDeployment } from '../projects/type';
export type BannerStatus = Exclude<StatusDeployment, 'pending'>;

interface StatusDisplayInput {
	status: BannerStatus;
	currentStepLabel?: string;
	durationLabel?: string;
	failedStepLabel?: string;
}

interface TimelineItemDisplayInput {
	status: StatusDeployment;
	title: string;
	timestamp?: string;
}

interface TimelineItemDisplay {
	title: string;
	subtitle?: string;
}

export function getTimelineItemDisplay({
	status,
	title,
	timestamp
}: TimelineItemDisplayInput): TimelineItemDisplay {
	switch (status) {
		case 'pending':
			return { title };
		case 'running':
			return { title, subtitle: 'Sedang berjalan...' };
		case 'success':
			return { title, subtitle: timestamp };
		case 'failed':
			return { title: `${title} - gagal`, subtitle: timestamp };
	}
}

const bannerIconColorMap: Partial<Record<BannerStatus, string>> = {
	running: 'bg-warning-dark text-white'
};

const bannerBgMap: Record<BannerStatus, string> = {
	running: 'bg-warning/10',
	success: 'bg-primary/10',
	failed: 'bg-error/10'
};

const timeLabelMap: Record<BannerStatus, string> = {
	running: 'Dimulai pada',
	success: 'Selesai pada',
	failed: 'Gagal pada'
};

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

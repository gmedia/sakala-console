import type { ProjectMetrics } from '$lib/api/resources/project-metrics';
import {
	cpuChart,
	memoryChart,
	restartsChart,
	type AlignedColumns
} from '../monitoring/chart-data';
import { formatBytes, formatCount, formatPercent } from '../monitoring/format';

/** The overview reads the Metrik tab's default range, so both share one cached query. */
export const OVERVIEW_METRICS_RANGE = '24h' as const;

export const OVERVIEW_METRICS_COPY = {
	title: 'Metrik 24 jam terakhir',
	link: 'Lihat di Metrik',
	notRunning: 'Metrik muncul beberapa menit setelah aplikasi pertama kali berjalan.',
	memory: 'Memori terakhir',
	cpu: 'CPU terakhir',
	restarts: 'Restart dalam 24 jam',
	cpuSparkline: 'Rata-rata CPU tiap step, 24 jam terakhir'
} as const;

export type OverviewMemory = {
	/** `256 MiB`, or null without a sample. */
	value: string | null;
	/** `dari batas 1 GiB`, or a note that no limit was reported. */
	note: string;
	/** Newest average against the limit, 0 to 1, for the meter. `null` without both. */
	ratio: number | null;
};

export type OverviewCpu = {
	value: string | null;
	note: string;
	/** `[times, avg]`, with `null` where the project had no samples, so the line breaks there. */
	sparkline: AlignedColumns;
};

export type OverviewRestarts = { value: string; note: string };

export type OverviewMetrics = {
	memory: OverviewMemory;
	cpu: OverviewCpu;
	restarts: OverviewRestarts;
};

const NO_SAMPLE_NOTE = 'Belum ada data di rentang ini.';

/**
 * The three numbers the overview leads with, from the same series and helpers as the Metrik tab, so
 * the two never disagree: memory against its limit, CPU now and at its peak, and restarts.
 */
export function summarizeMetrics(metrics: ProjectMetrics): OverviewMetrics {
	const memory = memoryChart(metrics);
	const cpu = cpuChart(metrics);
	const restarts = restartsChart(metrics);

	const memoryRatio =
		memory.latest !== null && memory.limit !== null
			? Math.min(1, Math.max(0, memory.latest / memory.limit))
			: null;

	return {
		memory: {
			value: memory.latest === null ? null : formatBytes(memory.latest),
			note:
				memory.latest === null
					? NO_SAMPLE_NOTE
					: memory.limit === null
						? 'Batasnya tidak tercatat.'
						: `dari batas ${formatBytes(memory.limit)}`,
			ratio: memoryRatio
		},
		cpu: {
			value: cpu.latest === null ? null : formatPercent(cpu.latest),
			note: cpu.peak === null ? NO_SAMPLE_NOTE : `tertinggi ${formatPercent(cpu.peak)}`,
			// Only the average: the sparkline shows the shape of the day, the Metrik tab the detail.
			sparkline: [cpu.columns[0], cpu.columns[1] ?? []]
		},
		restarts:
			restarts.columns[0].length === 0
				? { value: '-', note: NO_SAMPLE_NOTE }
				: restarts.total === 0
					? { value: '0', note: 'tidak ada restart' }
					: { value: formatCount(restarts.total), note: 'kali container dimulai ulang' }
	};
}

/** `25%`, for the meter's accessible value. */
export function formatRatio(ratio: number): string {
	return formatPercent(Math.round(ratio * 100));
}

import type { ProjectMetrics } from '$lib/api/resources/project-metrics';
import {
	cpuChart,
	hasPoints,
	memoryChart,
	replicasChart,
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
	titles: { memory: 'Memori', cpu: 'CPU', replicas: 'Replika' },
	noData: 'Belum ada data di rentang ini.'
} as const;

export type MiniChartId = keyof typeof OVERVIEW_METRICS_COPY.titles;

export type MiniChart = {
	id: MiniChartId;
	title: string;
	/** The newest value in words, shown at once and read instead of the canvas. */
	latest: string;
	/** `Maks 512 MiB`: the highest point of the day, in the chart's header. */
	peak: string | null;
	/**
	 * `[times, values...]` with gaps as `null`, exactly as the Metrik tab draws them: memory is
	 * `[times, average, peak, limit]`, CPU `[times, average, peak]`, replicas `[times, count]`. The
	 * peak line is kept so the "Maks" in the header is a point the reader can see.
	 */
	columns: AlignedColumns;
	hasData: boolean;
};

export type OverviewMetrics = {
	charts: MiniChart[];
	/** Restarts over the day, as a sentence under the charts. */
	restarts: string;
};

/**
 * Three small charts from the same series and helpers as the Metrik tab, so the two never
 * disagree: memory with its limit, CPU, and replicas. Restarts become one sentence.
 */
export function summarizeMetrics(metrics: ProjectMetrics): OverviewMetrics {
	const memory = memoryChart(metrics);
	const cpu = cpuChart(metrics);
	const replicas = replicasChart(metrics);
	const restarts = restartsChart(metrics);
	const { titles, noData } = OVERVIEW_METRICS_COPY;

	const memoryLatest =
		memory.latest === null
			? noData
			: memory.limit === null
				? `Terakhir ${formatBytes(memory.latest)}.`
				: `Terakhir ${formatBytes(memory.latest)} dari batas ${formatBytes(memory.limit)}.`;

	return {
		charts: [
			{
				id: 'memory',
				title: titles.memory,
				latest: memoryLatest,
				peak: memory.peak === null ? null : `Maks ${formatBytes(memory.peak)}`,
				columns: memory.columns,
				hasData: hasPoints(memory.columns)
			},
			{
				id: 'cpu',
				title: titles.cpu,
				latest: cpu.latest === null ? noData : `Terakhir ${formatPercent(cpu.latest)} dari 1 core.`,
				peak: cpu.peak === null ? null : `Maks ${formatPercent(cpu.peak)}`,
				columns: cpu.columns,
				hasData: hasPoints(cpu.columns)
			},
			{
				id: 'replicas',
				title: titles.replicas,
				latest:
					replicas.latest === null
						? noData
						: `Terakhir ${formatCount(replicas.latest)} replika berjalan.`,
				peak: replicas.peak === null ? null : `Maks ${formatCount(replicas.peak)}`,
				columns: replicas.columns,
				hasData: hasPoints(replicas.columns)
			}
		],
		restarts:
			restarts.columns[0].length === 0
				? 'Belum ada data restart dalam 24 jam terakhir.'
				: restarts.total === 0
					? 'Tidak ada restart dalam 24 jam terakhir.'
					: `${formatCount(restarts.total)} restart dalam 24 jam terakhir.`
	};
}

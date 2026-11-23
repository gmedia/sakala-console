import type { CountChart, MemoryChart, StatChart } from './chart-data';
import type { MetricsRangeOption } from './ranges';

export const MONITORING_COPY = {
	/** Short like the other tabs, so all four fit a 320 px screen. */
	tab: 'Metrik',
	intro: 'Pemakaian CPU, memori, replika, dan restart proyek ini.',
	rangeLabel: 'Rentang waktu',
	empty: {
		description: 'Data muncul beberapa menit setelah proyek berjalan.'
	},
	sleeping: 'Selama proyek tidur, metrik tidak dicatat, jadi grafik kosong di rentang itu.',
	error: 'Metrik belum bisa dimuat. Data yang sudah tercatat tidak hilang.',
	retry: 'Coba lagi',
	retrying: 'Memuat...',
	loading: 'Memuat metrik...',
	noPointsInRange: 'Belum ada data di rentang ini.',
	cpuNote:
		'100% = 1 core, dijumlah dari semua replika, jadi bisa lebih dari 100%. Diukur sesaat sekali per menit, jadi lonjakan singkat bisa terlewat.',
	/**
	 * How sakala-api counts (GetProjectMetricsAction): Docker's restarts of a crashed container, plus
	 * one per replica for every Restart a member asked for. Waking and recovering a replica start
	 * the container again without adding to the count.
	 */
	restartsNote:
		'Berapa kali container dinyalakan ulang, dijumlah dari semua replika: oleh Docker setelah crash, dan setiap kali kamu menekan Restart (satu per replika). Bangun dari tidur dan replika yang dipulihkan tidak dihitung. Setelah restart, CPU dan memori dicatat dari container yang baru menyala.',
	limitSince: 'Garis batas mulai dari saat jumlah replika itu berlaku.',
	/**
	 * The readout under a chart shows one point: the newest, or the one under the cursor. It names
	 * that point, and calls a point's maximum "Puncak", so it never reads like the summary's
	 * "tertinggi", which is the highest value of the whole range.
	 */
	series: {
		average: 'Rata-rata',
		peak: 'Puncak',
		limit: 'Batas',
		replicas: 'Replika',
		restarts: 'Restart',
		time: 'Titik'
	},
	newestPoint: (time: string) => `terbaru, ${time}`,
	titles: { cpu: 'CPU', memory: 'Memori', replicas: 'Replika', restarts: 'Restart' }
} as const;

const percentFormat = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });
const countFormat = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
const sizeFormat = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });

/** CPU as percent of one core: `12,5%`. */
export function formatPercent(value: number): string {
	return `${percentFormat.format(value)}%`;
}

export function formatCount(value: number): string {
	return countFormat.format(value);
}

/*
 * Binary units, like the container limit itself (Docker's 512m is 512 MiB). `Intl` only knows
 * decimal byte units, so these few lines stay here instead of pulling in a package.
 */
const BYTE_UNITS = ['B', 'KiB', 'MiB', 'GiB', 'TiB'] as const;
const BYTES_PER_UNIT = 1024;

/** Ticks on the memory axis: powers of two from 1 MiB, so they read 256 MiB, 512 MiB, 1 GiB. */
export const BYTE_AXIS_STEPS: readonly number[] = Array.from(
	{ length: 21 },
	(_, power) => 2 ** power * BYTES_PER_UNIT ** 2
);

/** Ticks on a count axis: whole numbers only. */
export const COUNT_AXIS_STEPS: readonly number[] = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];

/** `512 MiB`, `1,5 GiB`. */
export function formatBytes(bytes: number): string {
	let value = bytes;
	let unit = 0;
	while (Math.abs(value) >= BYTES_PER_UNIT && unit < BYTE_UNITS.length - 1) {
		value /= BYTES_PER_UNIT;
		unit++;
	}
	return `${sizeFormat.format(value)} ${BYTE_UNITS[unit]}`;
}

const shortTimeFormat = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' });
const shortDayFormat = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' });
const pointTimeFormat = new Intl.DateTimeFormat('id-ID', {
	day: 'numeric',
	month: 'short',
	hour: '2-digit',
	minute: '2-digit'
});

/** A time axis label: the clock for a day or less, the date for longer ranges. */
export function formatAxisTime(seconds: number, range: MetricsRangeOption): string {
	const date = new Date(seconds * 1_000);
	return range.seconds <= 24 * 60 * 60 ? shortTimeFormat.format(date) : shortDayFormat.format(date);
}

/** The time of one point, under the cursor: `18 Nov 14.30`. */
export function formatPointTime(seconds: number): string {
	return pointTimeFormat.format(new Date(seconds * 1_000));
}

/*
 * The text each chart carries, read out instead of the canvas and shown above it. It says the
 * newest value and the highest in the range, so nobody needs to see the line to get the gist.
 */

export function cpuSummary(chart: StatChart, range: MetricsRangeOption): string {
	if (chart.latest === null || chart.peak === null) return MONITORING_COPY.noPointsInRange;
	return `Terakhir ${formatPercent(chart.latest)}, tertinggi ${formatPercent(chart.peak)} dalam ${range.phrase}.`;
}

/** The limit behind the dashed line, and where the line starts when the replica count changed. */
export function memoryLimitNote(chart: MemoryChart): string | null {
	if (chart.limit === null) return null;
	const replicas = chart.latestReplicas;
	const limit =
		replicas !== null && replicas > 1
			? `Batas ${formatBytes(chart.limit)} untuk ${formatCount(replicas)} replika (${formatBytes(chart.limit / replicas)} per replika).`
			: `Batas ${formatBytes(chart.limit)}.`;
	return chart.limitCoversRange ? limit : `${limit} ${MONITORING_COPY.limitSince}`;
}

export function memorySummary(chart: MemoryChart, range: MetricsRangeOption): string {
	if (chart.latest === null || chart.peak === null) return MONITORING_COPY.noPointsInRange;
	return `Terakhir ${formatBytes(chart.latest)}, tertinggi ${formatBytes(chart.peak)} dalam ${range.phrase}.`;
}

export function replicasSummary(chart: CountChart, range: MetricsRangeOption): string {
	if (chart.latest === null || chart.peak === null) return MONITORING_COPY.noPointsInRange;
	return `Terakhir ${formatCount(chart.latest)} replika, paling banyak ${formatCount(chart.peak)} dalam ${range.phrase}.`;
}

export function restartsSummary(chart: CountChart, range: MetricsRangeOption): string {
	if (chart.columns[0].length === 0) return MONITORING_COPY.noPointsInRange;
	if (chart.total === 0) return `Tidak ada restart dalam ${range.phrase}.`;
	return `${formatCount(chart.total)} restart dalam ${range.phrase}.`;
}

/** No sample in the chosen range. A longer one may still have some, so the page offers it. */
export function emptyTitle(range: MetricsRangeOption): string {
	return `Belum ada data metrik dalam ${range.phrase}`;
}

export function widenRangeLabel(range: MetricsRangeOption): string {
	return `Lihat ${range.phrase}`;
}

/** When the charts were read, and whether they keep up on their own. */
export function freshnessNote(updatedAtMs: number, polls: boolean): string {
	const time = shortTimeFormat.format(new Date(updatedAtMs));
	return polls ? `Diperbarui pukul ${time}, dibaca ulang tiap menit.` : `Diperbarui pukul ${time}.`;
}

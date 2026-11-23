import type {
	MetricCountPoint,
	MetricStatPoint,
	ProjectMetrics
} from '$lib/api/resources/project-metrics';

/**
 * Columns sharing one time axis: `[times, ...values]`, times in Unix seconds. This is the shape uPlot
 * draws, and `null` is a point it leaves out, so a line stops there instead of crossing the gap.
 */
export type AlignedColumns = [number[], ...(number | null)[][]];

/**
 * A point may arrive up to half a bucket late without breaking the line. Further apart than this,
 * the buckets between them have no sample, and the chart shows that as a gap.
 */
const GAP_TOLERANCE_STEPS = 1.5;

/**
 * Lines up value columns, each a map from time to value, on the times any of them has. A missing
 * stretch longer than a bucket gets a `null` row right after its last point, which is all a line
 * needs to stop there.
 */
export function alignColumns(
	columns: readonly ReadonlyMap<number, number | null>[],
	stepSeconds: number
): AlignedColumns {
	const times = [...new Set(columns.flatMap((column) => [...column.keys()]))].sort((a, b) => a - b);
	const xs: number[] = [];
	const ys = columns.map((): (number | null)[] => []);

	times.forEach((time, index) => {
		const previous = times[index - 1];
		if (previous !== undefined && time - previous > stepSeconds * GAP_TOLERANCE_STEPS) {
			xs.push(previous + stepSeconds);
			ys.forEach((values) => values.push(null));
		}
		xs.push(time);
		columns.forEach((column, i) => ys[i].push(column.get(time) ?? null));
	});

	return [xs, ...ys];
}

const columnOf = <T extends { t: number }>(
	points: readonly T[],
	value: (point: T) => number | null
) => new Map(points.map((point) => [point.t, value(point)]));

/** The value of the newest point. */
function latestOf<T extends { t: number }>(
	points: readonly T[],
	value: (point: T) => number
): number | null {
	const newest = points.reduce<T | null>((a, b) => (a === null || b.t > a.t ? b : a), null);
	return newest === null ? null : value(newest);
}

function peakOf(values: readonly number[]): number | null {
	return values.length > 0 ? Math.max(...values) : null;
}

export type StatChart = {
	/** `[times, avg, max]`. */
	columns: AlignedColumns;
	latest: number | null;
	peak: number | null;
};

export type MemoryChart = StatChart & {
	/** `[times, avg, max, limit]`. */
	columns: AlignedColumns;
	/** Every replica's limit together, in the newest step. `null` without data or with no limit. */
	limit: number | null;
	/** Replicas in the newest step, the ones `limit` adds up. */
	latestReplicas: number | null;
	/** Whether the limit line covers every memory point, or only the stretch since the count changed. */
	limitCoversRange: boolean;
};

export type CountChart = {
	/** `[times, count]`. */
	columns: AlignedColumns;
	latest: number | null;
	peak: number | null;
	total: number;
};

export function hasPoints(columns: AlignedColumns): boolean {
	return columns[0].length > 0;
}

/** The newest average, and the highest peak of any step. */
function statSummary(points: readonly MetricStatPoint[]): Pick<StatChart, 'latest' | 'peak'> {
	return {
		latest: latestOf(points, (point) => point.avg),
		peak: peakOf(points.map((point) => point.max))
	};
}

function statChart(points: readonly MetricStatPoint[], stepSeconds: number): StatChart {
	return {
		columns: alignColumns(
			[columnOf(points, (point) => point.avg), columnOf(points, (point) => point.max)],
			stepSeconds
		),
		...statSummary(points)
	};
}

export function cpuChart(metrics: ProjectMetrics): StatChart {
	return statChart(metrics.series.cpu_percent, metrics.step_seconds);
}

/** The replicas at `time`: the newest count at or before it, since the count is a step. */
function replicasAt(sortedReplicas: readonly MetricCountPoint[], time: number): number | null {
	let count: number | null = null;
	for (const point of sortedReplicas) {
		if (point.t > time) break;
		count = point.count;
	}
	return count;
}

/**
 * `memory_limit_bytes` is one number: the limits of the replicas in the newest step, added up. It
 * holds for as long as that many replicas ran, so the line is drawn over the newest stretch of
 * memory points with the same replica count, and not before, where fewer or more replicas had a
 * different total. Only memory points get it, so it breaks with the memory line across a gap.
 */
export function memoryChart(metrics: ProjectMetrics): MemoryChart {
	const { memory_bytes: points, memory_limit_bytes: limit } = metrics.series;
	const sortedPoints = [...points].sort((a, b) => a.t - b.t);
	const replicas = [...metrics.series.replicas].sort((a, b) => a.t - b.t);
	const newest = sortedPoints.at(-1);
	const latestReplicas = newest ? replicasAt(replicas, newest.t) : null;

	const limited = new Set<number>();
	if (limit !== null) {
		for (let i = sortedPoints.length - 1; i >= 0; i--) {
			if (replicasAt(replicas, sortedPoints[i].t) !== latestReplicas) break;
			limited.add(sortedPoints[i].t);
		}
	}

	return {
		...statSummary(points),
		columns: alignColumns(
			[
				columnOf(points, (point) => point.avg),
				columnOf(points, (point) => point.max),
				columnOf(points, (point) => (limited.has(point.t) ? limit : null))
			],
			metrics.step_seconds
		),
		limit,
		latestReplicas,
		limitCoversRange: limited.size === points.length
	};
}

function countChart(points: readonly MetricCountPoint[], stepSeconds: number): CountChart {
	const counts = points.map((point) => point.count);
	return {
		columns: alignColumns([columnOf(points, (point) => point.count)], stepSeconds),
		latest: latestOf(points, (point) => point.count),
		peak: peakOf(counts),
		total: counts.reduce((sum, count) => sum + count, 0)
	};
}

export function replicasChart(metrics: ProjectMetrics): CountChart {
	return countChart(metrics.series.replicas, metrics.step_seconds);
}

export function restartsChart(metrics: ProjectMetrics): CountChart {
	return countChart(metrics.series.restarts, metrics.step_seconds);
}

/** No series has a single point yet: a new project, or one that has not run since sampling began. */
export function hasNoMetrics(metrics: ProjectMetrics): boolean {
	const { cpu_percent, memory_bytes, replicas, restarts } = metrics.series;
	return [cpu_percent, memory_bytes, replicas, restarts].every((points) => points.length === 0);
}

/** The time of the oldest point in any series, in Unix seconds, or `null` without any point. */
export function firstPointTime(metrics: ProjectMetrics): number | null {
	const { cpu_percent, memory_bytes, replicas, restarts } = metrics.series;
	const times = [cpu_percent, memory_bytes, replicas, restarts].flatMap((points) =>
		points.map((point) => point.t)
	);
	return times.length > 0 ? Math.min(...times) : null;
}

/**
 * When the data starts later than the window, so the empty left of the chart reads as "not yet
 * recorded" instead of "nothing happened". Within the same gap tolerance as a missing bucket, the
 * first point counts as the start of the window. `null` when the data fills the window.
 */
export function lateDataStart(metrics: ProjectMetrics, windowStart: number): number | null {
	const first = firstPointTime(metrics);
	if (first === null) return null;
	return first - windowStart > metrics.step_seconds * GAP_TOLERANCE_STEPS ? first : null;
}

import { rateLimitWait } from '$lib/api/rate-limit';
import type { ProjectMetricsRange } from '$lib/api/resources/project-metrics';

export type MetricsRangeOption = {
	value: ProjectMetricsRange;
	/** The selector's label. */
	label: string;
	/** How the summaries name the range: `dalam 24 jam terakhir`. */
	phrase: string;
	seconds: number;
	/** Whether a new bucket shows up often enough, against the whole range, to be worth asking for. */
	polls: boolean;
};

const HOUR_SECONDS = 60 * 60;
const DAY_SECONDS = 24 * HOUR_SECONDS;

export const METRICS_RANGE_OPTIONS: readonly MetricsRangeOption[] = [
	{ value: '1h', label: '1 jam', phrase: '1 jam terakhir', seconds: HOUR_SECONDS, polls: true },
	{ value: '6h', label: '6 jam', phrase: '6 jam terakhir', seconds: 6 * HOUR_SECONDS, polls: true },
	{
		value: '24h',
		label: '24 jam',
		phrase: '24 jam terakhir',
		seconds: DAY_SECONDS,
		polls: true
	},
	{
		value: '7d',
		label: '7 hari',
		phrase: '7 hari terakhir',
		seconds: 7 * DAY_SECONDS,
		polls: false
	},
	{
		value: '30d',
		label: '30 hari',
		phrase: '30 hari terakhir',
		seconds: 30 * DAY_SECONDS,
		polls: false
	}
];

export const DEFAULT_METRICS_RANGE: ProjectMetricsRange = '24h';

/** The query string parameter that keeps the range, so a view can be shared and walked back. */
export const METRICS_RANGE_PARAM = 'range';

/** The range in the query string, or `null` when none was picked: the page then picks one itself. */
export function readMetricsRange(search: URLSearchParams): ProjectMetricsRange | null {
	const value = search.get(METRICS_RANGE_PARAM);
	return METRICS_RANGE_OPTIONS.find((option) => option.value === value)?.value ?? null;
}

/** A project's age in seconds, or `null` when its creation time is missing or unreadable. */
export function projectAgeSeconds(createdAt: string | undefined, nowMs: number): number | null {
	const created = createdAt ? Date.parse(createdAt) : Number.NaN;
	return Number.isNaN(created) ? null : Math.max(0, (nowMs - created) / 1_000);
}

/**
 * The range a page opens on when none was picked: the shortest one a project's whole life fits in,
 * so a project made five minutes ago does not open on a day of empty chart. Never longer than the
 * default, which an older project keeps.
 */
export function defaultMetricsRange(ageSeconds: number | null): ProjectMetricsRange {
	const fallback = metricsRangeOption(DEFAULT_METRICS_RANGE);
	if (ageSeconds === null) return fallback.value;
	return (
		METRICS_RANGE_OPTIONS.find(
			(option) => option.seconds <= fallback.seconds && ageSeconds <= option.seconds
		)?.value ?? fallback.value
	);
}

/** Whether a wider range can show more than this one: not for a project younger than the range. */
export function rangeCoversProjectLife(
	range: MetricsRangeOption,
	ageSeconds: number | null
): boolean {
	return ageSeconds !== null && ageSeconds <= range.seconds;
}

export function metricsRangeOption(range: ProjectMetricsRange): MetricsRangeOption {
	return (
		METRICS_RANGE_OPTIONS.find((option) => option.value === range) ??
		(METRICS_RANGE_OPTIONS.find(
			(option) => option.value === DEFAULT_METRICS_RANGE
		) as MetricsRangeOption)
	);
}

/**
 * The agent samples about once a minute, so asking more often only spends `throttle:api`, which the
 * whole page shares. TanStack Query already skips the interval while the tab is in the background.
 */
export const METRICS_POLL_MS = 60_000;

/** Only a running project gets new samples: a sleeping or stopped one has nothing new to show. */
const SAMPLED_RUNTIME_STATUS = 'running';

export function resolveMetricsPollInterval(
	range: ProjectMetricsRange,
	runtimeStatus: string | undefined,
	error?: unknown
): number | false {
	const wait = rateLimitWait(error);
	if (wait !== undefined) return wait;
	if (runtimeStatus !== SAMPLED_RUNTIME_STATUS) return false;
	return metricsRangeOption(range).polls ? METRICS_POLL_MS : false;
}

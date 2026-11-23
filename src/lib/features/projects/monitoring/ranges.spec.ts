import { afterEach, describe, expect, it } from 'vitest';
import { ApiError } from '$lib/api/errors';
import { DEFAULT_RATE_LIMIT_WAIT_MS, resetRateLimit } from '$lib/api/rate-limit';
import { PROJECT_METRICS_RANGES } from '$lib/api/resources/project-metrics';
import {
	DEFAULT_METRICS_RANGE,
	METRICS_POLL_MS,
	METRICS_RANGE_OPTIONS,
	defaultMetricsRange,
	metricsRangeOption,
	projectAgeSeconds,
	rangeCoversProjectLife,
	readMetricsRange,
	resolveMetricsPollInterval
} from './ranges';

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

afterEach(() => resetRateLimit());

describe('metrics ranges', () => {
	it('offers every range the API accepts, shortest first, 24 hours by default', () => {
		expect(METRICS_RANGE_OPTIONS.map((option) => option.value)).toEqual([
			...PROJECT_METRICS_RANGES
		]);
		expect(METRICS_RANGE_OPTIONS.map((option) => option.label)).toEqual([
			'1 jam',
			'6 jam',
			'24 jam',
			'7 hari',
			'30 hari'
		]);
		expect(DEFAULT_METRICS_RANGE).toBe('24h');
	});
});

describe('resolveMetricsPollInterval', () => {
	it.each(['1h', '6h', '24h'] as const)('polls a running project every minute on %s', (range) => {
		expect(resolveMetricsPollInterval(range, 'running')).toBe(METRICS_POLL_MS);
		expect(METRICS_POLL_MS).toBe(60_000);
	});

	it.each(['7d', '30d'] as const)('does not poll %s, where a minute changes nothing', (range) => {
		expect(resolveMetricsPollInterval(range, 'running')).toBe(false);
	});

	it.each(['sleeping', 'stopped', 'crashed', 'failed', 'deploying', 'not_deployed', undefined])(
		'does not poll a project that is %s',
		(status) => {
			expect(resolveMetricsPollInterval('1h', status)).toBe(false);
		}
	);

	it('waits out a 429', () => {
		const error = new ApiError('Too Many Attempts.', 429);
		expect(resolveMetricsPollInterval('7d', 'sleeping', error)).toBe(DEFAULT_RATE_LIMIT_WAIT_MS);
	});
});

describe('readMetricsRange', () => {
	it('reads a range the API accepts from the query string', () => {
		expect(readMetricsRange(new URLSearchParams('range=7d'))).toBe('7d');
	});

	it.each(['', 'range=', 'range=2d', 'range=24H'])('reads no pick from "%s"', (query) => {
		expect(readMetricsRange(new URLSearchParams(query))).toBeNull();
	});
});

describe('projectAgeSeconds', () => {
	const NOW = Date.parse('2026-11-23T10:00:00Z');

	it('counts from the creation time', () => {
		expect(projectAgeSeconds('2026-11-23T09:55:00Z', NOW)).toBe(5 * MINUTE);
	});

	it('never goes below zero for a clock a little behind the server', () => {
		expect(projectAgeSeconds('2026-11-23T10:00:30Z', NOW)).toBe(0);
	});

	it.each([undefined, '', 'kemarin'])('knows no age from %s', (createdAt) => {
		expect(projectAgeSeconds(createdAt, NOW)).toBeNull();
	});
});

describe('defaultMetricsRange', () => {
	it.each([
		[5 * MINUTE, '1h'],
		[HOUR, '1h'],
		[HOUR + 1, '6h'],
		[5 * HOUR, '6h'],
		[7 * HOUR, '24h'],
		[DAY, '24h'],
		[3 * DAY, '24h'],
		[90 * DAY, '24h']
	] as const)('opens a project %i seconds old on %s', (age, range) => {
		expect(defaultMetricsRange(age)).toBe(range);
	});

	it('opens on the default when the age is unknown', () => {
		expect(defaultMetricsRange(null)).toBe(DEFAULT_METRICS_RANGE);
	});
});

describe('rangeCoversProjectLife', () => {
	it('is true when the whole project fits in the range, so a wider one adds nothing', () => {
		expect(rangeCoversProjectLife(metricsRangeOption('1h'), 5 * MINUTE)).toBe(true);
		expect(rangeCoversProjectLife(metricsRangeOption('1h'), 2 * HOUR)).toBe(false);
	});

	it('is false for an unknown age, so a wider range stays on offer', () => {
		expect(rangeCoversProjectLife(metricsRangeOption('1h'), null)).toBe(false);
	});
});

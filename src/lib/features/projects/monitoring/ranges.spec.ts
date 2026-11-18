import { afterEach, describe, expect, it } from 'vitest';
import { ApiError } from '$lib/api/errors';
import { DEFAULT_RATE_LIMIT_WAIT_MS, resetRateLimit } from '$lib/api/rate-limit';
import { PROJECT_METRICS_RANGES } from '$lib/api/resources/project-metrics';
import {
	DEFAULT_METRICS_RANGE,
	METRICS_POLL_MS,
	METRICS_RANGE_OPTIONS,
	readMetricsRange,
	resolveMetricsPollInterval
} from './ranges';

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

	it.each(['', 'range=', 'range=2d', 'range=24H'])('falls back to 24 hours for "%s"', (query) => {
		expect(readMetricsRange(new URLSearchParams(query))).toBe(DEFAULT_METRICS_RANGE);
	});
});

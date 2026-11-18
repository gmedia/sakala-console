import { describe, expect, it } from 'vitest';
import { parseProjectMetricsResponse } from './project-metrics';

const T = '2026-11-18T07:00:00+00:00';
const T_SECONDS = Date.parse('2026-11-18T07:00:00Z') / 1_000;

/** As sakala-api's ProjectMetricsResource sends it: wrapped in `data`, `t` in ISO 8601 UTC. */
const body = {
	data: {
		range: '24h',
		step_seconds: 900,
		series: {
			cpu_percent: [{ t: T, avg: 12.5, max: 140 }],
			memory_bytes: [{ t: T, avg: 1024, max: 2048 }],
			memory_limit_bytes: 536870912,
			replicas: [{ t: T, count: 2 }],
			restarts: [{ t: T, count: 0 }]
		}
	}
};

describe('parseProjectMetricsResponse', () => {
	it('reads the resource, with times as Unix seconds', () => {
		const metrics = parseProjectMetricsResponse(body);

		expect(metrics.step_seconds).toBe(900);
		expect(metrics.series.cpu_percent).toEqual([{ t: T_SECONDS, avg: 12.5, max: 140 }]);
		expect(metrics.series.memory_bytes).toEqual([{ t: T_SECONDS, avg: 1024, max: 2048 }]);
		expect(metrics.series.replicas).toEqual([{ t: T_SECONDS, count: 2 }]);
		expect(metrics.series.memory_limit_bytes).toBe(536870912);
	});

	it('reads a range without a limit, and ignores per_replica', () => {
		const metrics = parseProjectMetricsResponse({
			data: {
				...body.data,
				series: { ...body.data.series, memory_limit_bytes: null, per_replica: [] }
			}
		});
		expect(metrics.series.memory_limit_bytes).toBeNull();
		expect(metrics.series).not.toHaveProperty('per_replica');
	});

	it('drops a broken point on its own instead of failing the read', () => {
		const metrics = parseProjectMetricsResponse({
			data: {
				...body.data,
				series: {
					...body.data.series,
					cpu_percent: [
						{ t: 'kemarin', avg: 1, max: 1 },
						{ t: T, avg: '5', max: 1 },
						{ t: T, avg: 2, max: 3 }
					]
				}
			}
		});
		expect(metrics.series.cpu_percent).toEqual([{ t: T_SECONDS, avg: 2, max: 3 }]);
	});

	it('refuses a body without the series', () => {
		expect(() =>
			parseProjectMetricsResponse({ data: { range: '24h', step_seconds: 900 } })
		).toThrow();
	});
});

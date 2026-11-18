import { describe, expect, it } from 'vitest';
import type { ProjectMetrics } from '$lib/api/resources/project-metrics';
import {
	alignColumns,
	cpuChart,
	hasNoMetrics,
	memoryChart,
	replicasChart,
	restartsChart
} from './chart-data';

const STEP = 60;
const T0 = 1_795_000_000;
const at = (bucket: number) => T0 + bucket * STEP;
const MIB = 1024 * 1024;

function metrics(series: Partial<ProjectMetrics['series']> = {}): ProjectMetrics {
	return {
		range: '1h',
		step_seconds: STEP,
		series: {
			cpu_percent: [],
			memory_bytes: [],
			memory_limit_bytes: null,
			replicas: [],
			restarts: [],
			...series
		}
	};
}

describe('alignColumns', () => {
	it('lines columns up on the times any of them has, with null where one is missing', () => {
		const columns = alignColumns(
			[
				new Map([
					[at(0), 1],
					[at(1), 2]
				]),
				new Map([[at(1), 5]])
			],
			STEP
		);

		expect(columns).toEqual([
			[at(0), at(1)],
			[1, 2],
			[null, 5]
		]);
	});

	it('breaks the line after a missing stretch instead of drawing across it', () => {
		const columns = alignColumns(
			[
				new Map([
					[at(0), 10],
					[at(1), 20],
					[at(5), 30]
				])
			],
			STEP
		);

		// One null row right after the last point before the gap.
		expect(columns).toEqual([
			[at(0), at(1), at(2), at(5)],
			[10, 20, null, 30]
		]);
	});

	it('lets a point arrive a little late without a gap', () => {
		const columns = alignColumns(
			[
				new Map([
					[at(0), 1],
					[at(1) + 20, 2]
				])
			],
			STEP
		);

		expect(columns[1]).toEqual([1, 2]);
	});

	it('reads points in any order', () => {
		const columns = alignColumns(
			[
				new Map([
					[at(1), 2],
					[at(0), 1]
				])
			],
			STEP
		);

		expect(columns).toEqual([
			[at(0), at(1)],
			[1, 2]
		]);
	});

	it('gives empty columns for no points', () => {
		expect(alignColumns([new Map(), new Map()], STEP)).toEqual([[], [], []]);
	});
});

describe('cpuChart', () => {
	it('takes the newest average and the highest max', () => {
		const chart = cpuChart(
			metrics({
				cpu_percent: [
					{ t: at(0), avg: 40, max: 180 },
					{ t: at(1), avg: 12.5, max: 30 }
				]
			})
		);

		expect(chart.latest).toBe(12.5);
		// Percent of one core over every replica, so past 100 is real.
		expect(chart.peak).toBe(180);
		expect(chart.columns).toEqual([
			[at(0), at(1)],
			[40, 12.5],
			[180, 30]
		]);
	});

	it('takes the newest point however the points are ordered', () => {
		const chart = cpuChart(
			metrics({
				cpu_percent: [
					{ t: at(1), avg: 20, max: 25 },
					{ t: at(0), avg: 50, max: 60 }
				]
			})
		);

		expect(chart.latest).toBe(20);
		expect(chart.peak).toBe(60);
	});

	it('has nothing to say without points', () => {
		const chart = cpuChart(metrics());
		expect(chart.latest).toBeNull();
		expect(chart.peak).toBeNull();
	});
});

describe('memoryChart', () => {
	const memory = [
		{ t: at(0), avg: 200 * MIB, max: 220 * MIB },
		{ t: at(1), avg: 400 * MIB, max: 450 * MIB },
		{ t: at(2), avg: 410 * MIB, max: 500 * MIB }
	];
	const LIMIT_TWO_REPLICAS = 1024 * MIB;

	it('draws the limit over the whole range while the replica count stayed the same', () => {
		const chart = memoryChart(
			metrics({
				memory_bytes: memory,
				memory_limit_bytes: LIMIT_TWO_REPLICAS,
				replicas: memory.map(({ t }) => ({ t, count: 2 }))
			})
		);

		expect(chart.columns[3]).toEqual([LIMIT_TWO_REPLICAS, LIMIT_TWO_REPLICAS, LIMIT_TWO_REPLICAS]);
		expect(chart.limit).toBe(LIMIT_TWO_REPLICAS);
		expect(chart.latestReplicas).toBe(2);
		expect(chart.limitCoversRange).toBe(true);
		expect(chart.latest).toBe(410 * MIB);
		expect(chart.peak).toBe(500 * MIB);
	});

	it('draws the limit only since the newest replica count, which is what it adds up', () => {
		const chart = memoryChart(
			metrics({
				memory_bytes: memory,
				memory_limit_bytes: LIMIT_TWO_REPLICAS,
				replicas: [
					{ t: at(0), count: 1 },
					{ t: at(1), count: 2 },
					{ t: at(2), count: 2 }
				]
			})
		);

		// With one replica the total limit was a different number, which the API does not send.
		expect(chart.columns[3]).toEqual([null, LIMIT_TWO_REPLICAS, LIMIT_TWO_REPLICAS]);
		expect(chart.limitCoversRange).toBe(false);
	});

	it('draws no limit line without a limit', () => {
		const chart = memoryChart(
			metrics({ memory_bytes: memory, replicas: [{ t: at(0), count: 1 }] })
		);

		expect(chart.columns[3]).toEqual([null, null, null]);
		expect(chart.limit).toBeNull();
	});

	it('breaks the limit line with the memory line across a gap', () => {
		const chart = memoryChart(
			metrics({
				memory_bytes: [memory[0], { ...memory[1], t: at(4) }],
				memory_limit_bytes: 512 * MIB,
				replicas: [
					{ t: at(0), count: 1 },
					{ t: at(4), count: 1 }
				]
			})
		);

		expect(chart.columns[0]).toEqual([at(0), at(1), at(4)]);
		expect(chart.columns[1]).toEqual([200 * MIB, null, 400 * MIB]);
		expect(chart.columns[3]).toEqual([512 * MIB, null, 512 * MIB]);
	});
});

describe('count charts', () => {
	it('replicas: the newest count and the most in range', () => {
		const chart = replicasChart(
			metrics({
				replicas: [
					{ t: at(0), count: 3 },
					{ t: at(1), count: 2 }
				]
			})
		);

		expect(chart.latest).toBe(2);
		expect(chart.peak).toBe(3);
	});

	it('restarts: adds up the buckets', () => {
		const chart = restartsChart(
			metrics({
				restarts: [
					{ t: at(0), count: 0 },
					{ t: at(1), count: 2 },
					{ t: at(3), count: 1 }
				]
			})
		);

		expect(chart.total).toBe(3);
	});
});

describe('hasNoMetrics', () => {
	it('is true only when every series is empty', () => {
		expect(hasNoMetrics(metrics())).toBe(true);
		expect(hasNoMetrics(metrics({ restarts: [{ t: at(0), count: 0 }] }))).toBe(false);
	});

	it('does not count a limit as data', () => {
		expect(hasNoMetrics(metrics({ memory_limit_bytes: 512 * MIB }))).toBe(true);
	});
});

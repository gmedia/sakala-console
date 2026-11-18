import { describe, expect, it } from 'vitest';
import type { ProjectMetrics } from '$lib/api/resources/project-metrics';
import { formatRatio, summarizeMetrics } from './metrics-summary';

const STEP = 900;
const T0 = 1_795_000_000;
const at = (bucket: number) => T0 + bucket * STEP;
const MIB = 1024 * 1024;

function metrics(series: Partial<ProjectMetrics['series']> = {}): ProjectMetrics {
	return {
		range: '24h',
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

describe('the overview numbers', () => {
	it('puts the newest memory against its limit, as words and as a ratio', () => {
		const summary = summarizeMetrics(
			metrics({
				memory_bytes: [
					{ t: at(0), avg: 100 * MIB, max: 120 * MIB },
					{ t: at(1), avg: 256 * MIB, max: 300 * MIB }
				],
				memory_limit_bytes: 1024 * MIB,
				replicas: [{ t: at(0), count: 1 }]
			})
		);
		expect(summary.memory).toEqual({ value: '256 MiB', note: 'dari batas 1 GiB', ratio: 0.25 });
		expect(formatRatio(0.25)).toBe('25%');
	});

	it('draws no meter without a limit, and says so', () => {
		const summary = summarizeMetrics(
			metrics({ memory_bytes: [{ t: at(0), avg: 64 * MIB, max: 64 * MIB }] })
		);
		expect(summary.memory).toEqual({
			value: '64 MiB',
			note: 'Batasnya tidak tercatat.',
			ratio: null
		});
	});

	it('gives CPU now and at its peak, and the average line for the sparkline', () => {
		const summary = summarizeMetrics(
			metrics({
				cpu_percent: [
					{ t: at(0), avg: 40, max: 150 },
					{ t: at(1), avg: 12.5, max: 30 }
				]
			})
		);
		expect(summary.cpu.value).toBe('12,5%');
		expect(summary.cpu.note).toBe('tertinggi 150%');
		expect(summary.cpu.sparkline).toEqual([
			[at(0), at(1)],
			[40, 12.5]
		]);
	});

	it('breaks the sparkline where samples are missing, like the Metrik chart', () => {
		const summary = summarizeMetrics(
			metrics({
				cpu_percent: [
					{ t: at(0), avg: 10, max: 10 },
					{ t: at(5), avg: 20, max: 20 }
				]
			})
		);
		expect(summary.cpu.sparkline[1]).toEqual([10, null, 20]);
	});

	it('counts restarts over the day, and says when there were none or no samples', () => {
		const counted = summarizeMetrics(
			metrics({
				restarts: [
					{ t: at(0), count: 1 },
					{ t: at(1), count: 2 }
				]
			})
		);
		expect(counted.restarts).toEqual({ value: '3', note: 'kali container dimulai ulang' });
		const none = summarizeMetrics(metrics({ restarts: [{ t: at(0), count: 0 }] }));
		expect(none.restarts).toEqual({ value: '0', note: 'tidak ada restart' });
		expect(summarizeMetrics(metrics()).restarts.value).toBe('-');
	});

	it('caps the meter at a full bar when memory passes the limit', () => {
		const summary = summarizeMetrics(
			metrics({
				memory_bytes: [{ t: at(0), avg: 600 * MIB, max: 600 * MIB }],
				memory_limit_bytes: 512 * MIB,
				replicas: [{ t: at(0), count: 1 }]
			})
		);
		expect(summary.memory.ratio).toBe(1);
	});
});

import { describe, expect, it } from 'vitest';
import type { ProjectMetrics } from '$lib/api/resources/project-metrics';
import { summarizeMetrics } from './metrics-summary';

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

const chart = (summary: ReturnType<typeof summarizeMetrics>, id: string) =>
	summary.charts.find((item) => item.id === id);

describe('the overview charts', () => {
	it('are memory, CPU, and replicas, in that order', () => {
		expect(summarizeMetrics(metrics()).charts.map((item) => item.id)).toEqual([
			'memory',
			'cpu',
			'replicas'
		]);
	});

	it('give memory now against its limit, its peak, and the Metrik tab columns with the limit line', () => {
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
		const memory = chart(summary, 'memory');
		expect(memory?.latest).toBe('Terakhir 256 MiB dari batas 1 GiB.');
		expect(memory?.peak).toBe('Maks 300 MiB');
		expect(memory?.columns).toEqual([
			[at(0), at(1)],
			[100 * MIB, 256 * MIB],
			[120 * MIB, 300 * MIB],
			[1024 * MIB, 1024 * MIB]
		]);
		expect(memory?.hasData).toBe(true);
	});

	it('leave the limit out of the words when none was reported', () => {
		const summary = summarizeMetrics(
			metrics({ memory_bytes: [{ t: at(0), avg: 64 * MIB, max: 64 * MIB }] })
		);
		expect(chart(summary, 'memory')?.latest).toBe('Terakhir 64 MiB.');
	});

	it('give CPU in percent of one core, with its peak', () => {
		const summary = summarizeMetrics(
			metrics({
				cpu_percent: [
					{ t: at(0), avg: 40, max: 150 },
					{ t: at(1), avg: 12.5, max: 30 }
				]
			})
		);
		expect(chart(summary, 'cpu')).toMatchObject({
			latest: 'Terakhir 12,5% dari 1 core.',
			peak: 'Maks 150%'
		});
	});

	it('break lines where samples are missing, like the Metrik chart', () => {
		const summary = summarizeMetrics(
			metrics({
				cpu_percent: [
					{ t: at(0), avg: 10, max: 10 },
					{ t: at(5), avg: 20, max: 20 }
				]
			})
		);
		expect(chart(summary, 'cpu')?.columns[1]).toEqual([10, null, 20]);
	});

	it('give replicas as a step, with the most that ran', () => {
		const summary = summarizeMetrics(
			metrics({
				replicas: [
					{ t: at(0), count: 1 },
					{ t: at(1), count: 3 },
					{ t: at(2), count: 2 }
				]
			})
		);
		expect(chart(summary, 'replicas')).toMatchObject({
			latest: 'Terakhir 2 replika berjalan.',
			peak: 'Maks 3'
		});
	});

	it('say a series has no samples instead of drawing an empty chart', () => {
		const memory = chart(summarizeMetrics(metrics()), 'memory');
		expect(memory).toMatchObject({
			latest: 'Belum ada data di rentang ini.',
			peak: null,
			hasData: false
		});
	});

	it('count restarts over the day, and say when there were none or no samples', () => {
		const counted = summarizeMetrics(
			metrics({
				restarts: [
					{ t: at(0), count: 1 },
					{ t: at(1), count: 2 }
				]
			})
		);
		expect(counted.restarts).toBe('3 restart dalam 24 jam terakhir.');
		expect(summarizeMetrics(metrics({ restarts: [{ t: at(0), count: 0 }] })).restarts).toBe(
			'Tidak ada restart dalam 24 jam terakhir.'
		);
		expect(summarizeMetrics(metrics()).restarts).toBe(
			'Belum ada data restart dalam 24 jam terakhir.'
		);
	});
});

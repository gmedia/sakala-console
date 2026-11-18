import { describe, expect, it } from 'vitest';
import type { CountChart, MemoryChart, StatChart } from './chart-data';
import {
	MONITORING_COPY,
	cpuSummary,
	emptyTitle,
	formatBytes,
	freshnessNote,
	formatPercent,
	memoryLimitNote,
	memorySummary,
	replicasSummary,
	restartsSummary,
	widenRangeLabel
} from './format';
import { metricsRangeOption } from './ranges';

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;
const DAY = metricsRangeOption('24h');
const ONE_POINT: StatChart['columns'] = [[1], [1], [1]];

describe('formatBytes', () => {
	it.each([
		[0, '0 B'],
		[512, '512 B'],
		[1536, '1,5 KiB'],
		[512 * MIB, '512 MiB'],
		[300.25 * MIB, '300,3 MiB'],
		[1.5 * GIB, '1,5 GiB'],
		[GIB, '1 GiB']
	])('%d bytes reads %s', (bytes, text) => {
		expect(formatBytes(bytes)).toBe(text);
	});
});

describe('formatPercent', () => {
	it('writes percent of one core with an Indonesian decimal comma', () => {
		expect(formatPercent(12.5)).toBe('12,5%');
		expect(formatPercent(180)).toBe('180%');
	});
});

describe('summaries', () => {
	it('CPU: newest and highest in the range', () => {
		const chart: StatChart = { columns: ONE_POINT, latest: 12.5, peak: 180 };
		expect(cpuSummary(chart, DAY)).toBe('Terakhir 12,5%, tertinggi 180% dalam 24 jam terakhir.');
	});

	it('memory: newest and highest in binary units', () => {
		const chart: MemoryChart = {
			columns: ONE_POINT,
			latest: 256 * MIB,
			peak: 1.5 * GIB,
			limit: null,
			latestReplicas: 1,
			limitCoversRange: true
		};
		expect(memorySummary(chart, metricsRangeOption('7d'))).toBe(
			'Terakhir 256 MiB, tertinggi 1,5 GiB dalam 7 hari terakhir.'
		);
	});

	it('says there is no data when the range has none', () => {
		const empty: StatChart = { columns: [[], [], []], latest: null, peak: null };
		expect(cpuSummary(empty, DAY)).toBe(MONITORING_COPY.noPointsInRange);
	});

	it('replicas and restarts', () => {
		const replicas: CountChart = { columns: [[1], [2]], latest: 2, peak: 3, total: 5 };
		expect(replicasSummary(replicas, DAY)).toBe(
			'Terakhir 2 replika, paling banyak 3 dalam 24 jam terakhir.'
		);

		const restarts: CountChart = {
			columns: [
				[1, 2],
				[0, 3]
			],
			latest: 3,
			peak: 3,
			total: 3
		};
		expect(restartsSummary(restarts, DAY)).toBe('3 restart dalam 24 jam terakhir.');
		expect(restartsSummary({ ...restarts, total: 0 }, DAY)).toBe(
			'Tidak ada restart dalam 24 jam terakhir.'
		);
	});
});

describe('memoryLimitNote', () => {
	const base: MemoryChart = {
		columns: ONE_POINT,
		latest: 1,
		peak: 1,
		limit: 512 * MIB,
		latestReplicas: 1,
		limitCoversRange: true
	};

	it('names the limit of a single replica', () => {
		expect(memoryLimitNote(base)).toBe('Batas 512 MiB.');
	});

	it("names the total and one replica's share when several run", () => {
		expect(memoryLimitNote({ ...base, limit: 1.5 * GIB, latestReplicas: 3 })).toBe(
			'Batas 1,5 GiB untuk 3 replika (512 MiB per replika).'
		);
	});

	it('says where the line starts when the replica count changed in the range', () => {
		expect(memoryLimitNote({ ...base, limitCoversRange: false })).toBe(
			`Batas 512 MiB. ${MONITORING_COPY.limitSince}`
		);
	});

	it('says nothing without a limit', () => {
		expect(memoryLimitNote({ ...base, limit: null })).toBeNull();
	});
});

describe('page copy', () => {
	it('names the range that has no data, and the longer one to try', () => {
		expect(emptyTitle(metricsRangeOption('1h'))).toBe('Belum ada data metrik dalam 1 jam terakhir');
		expect(widenRangeLabel(metricsRangeOption('30d'))).toBe('Lihat 30 hari terakhir');
	});

	it('says when the charts were read, and whether they refresh', () => {
		const at = new Date(2026, 10, 18, 14, 5, 9).getTime();
		expect(freshnessNote(at, true)).toBe('Diperbarui pukul 14.05, dibaca ulang tiap menit.');
		expect(freshnessNote(at, false)).toBe('Diperbarui pukul 14.05.');
	});
});

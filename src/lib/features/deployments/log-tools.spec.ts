import { describe, expect, it } from 'vitest';
import type { DeploymentLogLine } from './deployment-logs';
import {
	ALL_LOG_PROCESSES,
	filterLogLines,
	linePermalinkHash,
	logDownloadFileName,
	logProcessOf,
	logProcessOptions,
	parseLinePermalink
} from './log-tools';

const line = (sequence: number, message: string): DeploymentLogLine => ({
	sequence,
	stream: 'stderr',
	message,
	recorded_at: '2026-09-20T08:41:22.000000Z'
});

const LINES = [
	line(1, 'Cloning into source'),
	line(2, 'vite build'),
	line(3, 'ENOENT: no such file')
];

describe('permalinks', () => {
	it('reads #L120 and nothing else', () => {
		expect(parseLinePermalink('#L120')).toBe(120);
		expect(parseLinePermalink('#deployment-logs')).toBeNull();
		expect(parseLinePermalink('#L0')).toBeNull();
		expect(parseLinePermalink('#L12a')).toBeNull();
		expect(linePermalinkHash(120)).toBe('#L120');
	});
});

describe('filterLogLines', () => {
	const levelOf = (item: DeploymentLogLine) => (item.sequence === 3 ? 'error' : 'normal');

	it('keeps every line without a query or filter', () => {
		expect(filterLogLines(LINES, { query: '', errorsOnly: false, levelOf })).toHaveLength(3);
	});

	it('searches without regard to case', () => {
		expect(
			filterLogLines(LINES, { query: 'VITE', errorsOnly: false, levelOf }).map((l) => l.sequence)
		).toEqual([2]);
	});

	it('keeps only error lines by the same levels as the colours, not every stderr line', () => {
		expect(
			filterLogLines(LINES, { query: '', errorsOnly: true, levelOf }).map((l) => l.sequence)
		).toEqual([3]);
	});

	it('combines both', () => {
		expect(filterLogLines(LINES, { query: 'vite', errorsOnly: true, levelOf })).toEqual([]);
	});
});

describe('logDownloadFileName', () => {
	it('names the project and the deployment', () => {
		expect(logDownloadFileName('toko-kopi-web', 5)).toBe('toko-kopi-web-deployment-5.txt');
		expect(logDownloadFileName('Kafé Rani / Web', 2)).toBe('kafe-rani-web-deployment-2.txt');
		expect(logDownloadFileName('🚀', 1)).toBe('proyek-deployment-1.txt');
	});
});

describe('process filter (ADR-022)', () => {
	const levelOf = () => 'normal' as const;
	const from = (sequence: number, process: string | null): DeploymentLogLine => ({
		...line(sequence, `baris ${sequence}`),
		process
	});
	const MIXED = [from(1, null), from(2, 'queue'), from(3, 'job'), from(4, 'mailer'), from(5, null)];

	it('offers web and each worker by name, never the scheduled runs', () => {
		expect(logProcessOptions(MIXED)).toEqual(['web', 'mailer', 'queue']);
		expect(logProcessOptions([from(1, null), from(2, 'job')])).toEqual(['web']);
		expect(logProcessOf(from(1, null))).toBe('web');
	});

	it('always leaves out scheduled runs, and keeps one process when asked', () => {
		const all = filterLogLines(MIXED, { query: '', errorsOnly: false, levelOf });
		expect(all.map((item) => item.sequence)).toEqual([1, 2, 4, 5]);
		const web = filterLogLines(MIXED, { query: '', errorsOnly: false, levelOf, process: 'web' });
		expect(web.map((item) => item.sequence)).toEqual([1, 5]);
		const queue = filterLogLines(MIXED, {
			query: 'baris 2',
			errorsOnly: false,
			levelOf,
			process: 'queue'
		});
		expect(queue.map((item) => item.sequence)).toEqual([2]);
		expect(
			filterLogLines(MIXED, { query: '', errorsOnly: false, levelOf, process: ALL_LOG_PROCESSES })
		).toHaveLength(4);
	});
});

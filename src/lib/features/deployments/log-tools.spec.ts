import { describe, expect, it } from 'vitest';
import type { DeploymentLogLine } from './deployment-logs';
import {
	filterLogLines,
	linePermalinkHash,
	logDownloadFileName,
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

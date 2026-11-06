import { describe, expect, it } from 'vitest';
import { ApiError, NetworkError } from '$lib/api/errors';
import {
	flattenLogPages,
	formatLogsForClipboard,
	getDeploymentLogErrorConfig,
	getLogRetentionStart,
	isLogRetentionExpired,
	highestLogSequence,
	insertLogLine,
	isNewestPageCached,
	LOG_MAX_LINES,
	logRetryDelay,
	mergeLogTail,
	normalizeLogMessage,
	shouldRetryLogRequest,
	type DeploymentLogLine,
	type DeploymentLogsCache
} from './deployment-logs';

function line(sequence: number, overrides: Partial<DeploymentLogLine> = {}): DeploymentLogLine {
	return {
		sequence,
		stream: 'stdout',
		message: `baris ${sequence}`,
		recorded_at: '2026-09-20T08:41:02.000000Z',
		...overrides
	};
}

describe('normalizeLogMessage', () => {
	it.each([
		['warna SGR', '\u001B[31mERROR\u001B[0m build', 'ERROR build'],
		['warna 256', '\u001B[38;5;196mmerah\u001B[39m', 'merah'],
		['warna truecolor', '\u001B[38;2;255;0;0mmerah\u001B[0m', 'merah'],
		['hyperlink OSC 8', '\u001B]8;;https://sakala.dev\u0007tautan\u001B]8;;\u0007', 'tautan'],
		['gerakan kursor', '\u001B[2K\u001B[1Gselesai', 'selesai'],
		['progress dengan carriage return', 'unduh 10%\runduh 50%\runduh 100%', 'unduh 100%'],
		['CRLF', 'baris satu\r\n', 'baris satu'],
		['backspace dan bel', 'a\u0008b\u0007c', 'abc'],
		['tab dipertahankan', 'kolom\tdua', 'kolom\tdua'],
		['baris majemuk', 'satu\ndua', 'satu\ndua'],
		['HTML tetap teks', '<img src=x onerror=alert(1)>', '<img src=x onerror=alert(1)>'],
		['teks Indonesia', 'Membangun aplikasi — selesai ✓', 'Membangun aplikasi — selesai ✓']
	])('%s', (_name, input, expected) => {
		expect(normalizeLogMessage(input)).toBe(expected);
	});
});

describe('flattenLogPages', () => {
	it('dedupes overlapping pages by the log sequence and sorts them', () => {
		const result = flattenLogPages([
			{ data: [line(3), line(4)] },
			{ data: [line(4, { message: 'versi baru' }), line(5)] },
			{ data: [line(1)] }
		]);

		expect(result.map((item) => item.sequence)).toEqual([1, 3, 4, 5]);
		expect(result[2].message).toBe('versi baru');
	});

	it('strips ANSI from what gets rendered', () => {
		expect(
			flattenLogPages([{ data: [line(1, { message: '\u001B[32mok\u001B[0m' })] }])[0].message
		).toBe('ok');
	});
});

function logPage(lines: DeploymentLogLine[], nextCursor: string | null = null) {
	return {
		data: lines,
		links: { first: null, last: null, prev: null, next: null },
		meta: { path: null, per_page: 200, next_cursor: nextCursor, prev_cursor: null }
	};
}

function cacheOf(
	lines: DeploymentLogLine[],
	nextCursor: string | null = null
): DeploymentLogsCache {
	return { pages: [logPage(lines, nextCursor)], pageParams: [null] };
}

const sequences = (cache: DeploymentLogsCache) =>
	flattenLogPages(cache.pages).map((item) => item.sequence);

describe('insertLogLine', () => {
	it('adds a line that history does not have', () => {
		expect(sequences(insertLogLine(cacheOf([line(2), line(1)]), line(3)))).toEqual([1, 2, 3]);
	});

	it('dedupes on the log sequence, so a broadcast already in history adds nothing', () => {
		const cache = cacheOf([line(2), line(1)]);

		expect(insertLogLine(cache, line(2))).toBe(cache);
	});
});

describe('mergeLogTail', () => {
	it('merges an overlapping read and keeps the cursor to older lines', () => {
		const merged = mergeLogTail(cacheOf([line(2), line(1)], 'older'), logPage([line(3), line(2)]));

		expect(sequences(merged)).toEqual([1, 2, 3]);
		expect(merged.pages[0].meta.next_cursor).toBe('older');
	});

	it('restarts from the fresh page when it leaves a gap, so older lines stay reachable', () => {
		const merged = mergeLogTail(cacheOf([line(1)]), logPage([line(300), line(299)], 'fresh'));

		expect(sequences(merged)).toEqual([299, 300]);
		expect(merged.pages[0].meta.next_cursor).toBe('fresh');
	});

	it('restarts once the cache is over its bound', () => {
		const full = Array.from({ length: LOG_MAX_LINES + 1 }, (_, index) => line(index + 1));
		const merged = mergeLogTail(cacheOf(full), logPage([line(LOG_MAX_LINES + 2)], 'fresh'));

		expect(sequences(merged)).toEqual([LOG_MAX_LINES + 2]);
	});

	it('goes back to the newest page when the window had moved away from it', () => {
		const evicted: DeploymentLogsCache = { pages: [logPage([line(5)])], pageParams: ['older'] };

		expect(isNewestPageCached(evicted)).toBe(false);
		expect(isNewestPageCached(mergeLogTail(evicted, logPage([line(9)])))).toBe(true);
	});

	it('leaves the cache alone on an empty read', () => {
		const cache = cacheOf([line(1)]);

		expect(mergeLogTail(cache, logPage([]))).toBe(cache);
	});
});

describe('highestLogSequence', () => {
	it('looks across pages, whatever their order', () => {
		const cache: DeploymentLogsCache = {
			pages: [logPage([line(9), line(4)]), logPage([line(3)])],
			pageParams: [null, 'c']
		};

		expect(highestLogSequence(cache)).toBe(9);
	});
});

describe('log retention', () => {
	const now = Date.parse('2026-11-08T00:00:00Z');

	it('starts the clock like PruneDeploymentLogsAction', () => {
		expect(getLogRetentionStart({ finished_at: 'f', cancelled_at: 'c', created_at: 'd' })).toBe(
			'f'
		);
		expect(getLogRetentionStart({ finished_at: null, cancelled_at: 'c', created_at: 'd' })).toBe(
			'c'
		);
		expect(getLogRetentionStart({ finished_at: null, cancelled_at: null, created_at: 'd' })).toBe(
			'd'
		);
	});

	it('expires exactly at 7 days', () => {
		const deployment = (finished_at: string) => ({
			finished_at,
			cancelled_at: null,
			created_at: null
		});

		expect(isLogRetentionExpired(deployment('2026-11-01T00:00:00Z'), now)).toBe(true);
		expect(isLogRetentionExpired(deployment('2026-11-01T00:00:01Z'), now)).toBe(false);
	});

	it('does not claim expiry without a usable date', () => {
		expect(
			isLogRetentionExpired({ finished_at: null, cancelled_at: null, created_at: null }, now)
		).toBe(false);
		expect(
			isLogRetentionExpired({ finished_at: 'x', cancelled_at: null, created_at: null }, now)
		).toBe(false);
	});
});

describe('formatLogsForClipboard', () => {
	it('copies lines with time and stream, nothing else', () => {
		const text = formatLogsForClipboard(
			[line(1), line(2, { stream: 'stderr', message: 'peringatan' })],
			() => '08:41:02'
		);

		expect(text).toBe('[08:41:02] baris 1\n[08:41:02] stderr peringatan');
	});
});

describe('log request policy', () => {
	it('does not retry a refusal, but does retry a rate limit or outage', () => {
		expect(shouldRetryLogRequest(0, new ApiError('x', 403))).toBe(false);
		expect(shouldRetryLogRequest(0, new ApiError('x', 404))).toBe(false);
		expect(shouldRetryLogRequest(0, new ApiError('x', 429))).toBe(true);
		expect(shouldRetryLogRequest(0, new ApiError('x', 500))).toBe(true);
		expect(shouldRetryLogRequest(0, new NetworkError())).toBe(true);
		expect(shouldRetryLogRequest(2, new ApiError('x', 500))).toBe(false);
	});

	it('waits as long as Retry-After says', () => {
		const limited = new ApiError('x', 429, {}, undefined, { retryAfterSeconds: 12 });

		expect(logRetryDelay(0, limited)).toBe(12_000);
		expect(logRetryDelay(0, new ApiError('x', 429))).toBe(30_000);
		expect(logRetryDelay(1, new NetworkError())).toBe(2_000);
	});

	it('offers retry only when it can help', () => {
		expect(getDeploymentLogErrorConfig(new NetworkError()).showRetry).toBe(true);
		expect(getDeploymentLogErrorConfig(new ApiError('x', 500)).showRetry).toBe(true);
		expect(getDeploymentLogErrorConfig(new ApiError('x', 403)).showRetry).toBe(false);
		expect(getDeploymentLogErrorConfig(new ApiError('x', 404)).showRetry).toBe(false);
		expect(getDeploymentLogErrorConfig(new ApiError('Tunggu.', 429)).description).toBe('Tunggu.');
	});
});

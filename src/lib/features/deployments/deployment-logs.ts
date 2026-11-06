import { DEFAULT_RATE_LIMIT_WAIT_MS } from '$lib/api/rate-limit';
import stripAnsi from 'strip-ansi';
import type { InfiniteData } from '@tanstack/svelte-query';
import { ApiError, NetworkError } from '$lib/api/errors';
import type {
	Deployment,
	DeploymentLog,
	DeploymentLogsResponse
} from '$lib/api/resources/deployment';

/** `IndexDeploymentLogRequest` accepts up to 200 lines a page. */
export const LOG_PAGE_SIZE = 200;
/** Upper bound on what the browser keeps: 10 pages of 200 is 2.000 lines. */
export const LOG_MAX_PAGES = 10;
export const LOG_MAX_LINES = LOG_PAGE_SIZE * LOG_MAX_PAGES;

/** A tail read after a gap in realtime: `throttle:api` allows 60 requests a minute per user. */
export const LOG_REALTIME_COALESCE_MS = 3_000;

/** `sakala.pilot_limits.log_retention_days` defaults to 7, and the API does not expose its value. */
export const LOG_RETENTION_DAYS = 7;
const LOG_RETENTION_MS = LOG_RETENTION_DAYS * 24 * 60 * 60 * 1_000;

export type DeploymentLogLine = DeploymentLog;

export type DeploymentLogsCache = InfiniteData<DeploymentLogsResponse, string | null>;

/**
 * Turns raw process output into plain text. A carriage return redraws the terminal line, so only
 * the last redraw is kept, and leftover control characters are removed. Tab and newline stay.
 */
export function normalizeLogMessage(message: string): string {
	const withoutAnsi = stripAnsi(message);
	const lines = withoutAnsi.split('\n').map((line) => {
		const redraws = line.split('\r').filter((part) => part.length > 0);
		return redraws.at(-1) ?? '';
	});

	return lines
		.join('\n')
		.replace(/[^\P{Cc}\t\n]/gu, '')
		.trimEnd();
}

/**
 * Flattens cached pages into display lines. Pages arrive newest first and can overlap with realtime
 * lines, so the log's own `sequence` is the dedupe key and the sort order.
 */
export function flattenLogPages(
	pages: readonly Pick<DeploymentLogsResponse, 'data'>[]
): DeploymentLogLine[] {
	const bySequence = new Map<number, DeploymentLogLine>();

	for (const page of pages) {
		for (const line of page.data) {
			bySequence.set(line.sequence, line);
		}
	}

	return [...bySequence.values()]
		.sort((a, b) => a.sequence - b.sequence)
		.map((line) => ({ ...line, message: normalizeLogMessage(line.message) }));
}

/** False once loading older pages has evicted the newest one, which `maxPages` can do. */
export function isNewestPageCached(cache: { pageParams: readonly unknown[] }): boolean {
	return (cache.pageParams[0] ?? null) === null;
}

export function countLogLines(cache: DeploymentLogsCache): number {
	return cache.pages.reduce((total, page) => total + page.data.length, 0);
}

export function highestLogSequence(cache: DeploymentLogsCache): number {
	return cache.pages.reduce(
		(highest, page) => page.data.reduce((max, line) => Math.max(max, line.sequence), highest),
		0
	);
}

/** Adds a realtime line to the newest page, unless history already holds that `log_sequence`. */
export function insertLogLine(
	cache: DeploymentLogsCache,
	line: DeploymentLogLine
): DeploymentLogsCache {
	if (cache.pages.some((page) => page.data.some((item) => item.sequence === line.sequence))) {
		return cache;
	}

	const [newest, ...older] = cache.pages;
	return { ...cache, pages: [{ ...newest, data: [line, ...newest.data] }, ...older] };
}

/**
 * Merges a fresh read of the newest lines. The cached cursors stay valid while the fresh page
 * overlaps or touches what is cached. When it does not, or the cache is over its bound, the cache
 * restarts from the fresh page, whose own `next_cursor` still reaches everything older.
 */
export function mergeLogTail(
	cache: DeploymentLogsCache,
	page: DeploymentLogsResponse
): DeploymentLogsCache {
	const restart: DeploymentLogsCache = { pages: [page], pageParams: [null] };

	if (!isNewestPageCached(cache) || cache.pages.length === 0) return restart;
	if (page.data.length === 0) return cache;

	const lowestFresh = page.data.reduce((min, line) => Math.min(min, line.sequence), Infinity);
	const leavesGap = page.meta.next_cursor !== null && lowestFresh > highestLogSequence(cache) + 1;
	if (leavesGap || countLogLines(cache) > LOG_MAX_LINES) return restart;

	return page.data.reduce(insertLogLine, cache);
}

/** Mirrors `PruneDeploymentLogsAction`: the clock starts at finished_at, cancelled_at, or created_at. */
export function getLogRetentionStart(
	deployment: Pick<Deployment, 'finished_at' | 'cancelled_at' | 'created_at'>
): string | null {
	return deployment.finished_at ?? deployment.cancelled_at ?? deployment.created_at;
}

export function isLogRetentionExpired(
	deployment: Pick<Deployment, 'finished_at' | 'cancelled_at' | 'created_at'>,
	now: number = Date.now()
): boolean {
	const start = getLogRetentionStart(deployment);
	if (!start) return false;

	const startedAt = new Date(start).getTime();
	return !Number.isNaN(startedAt) && now - startedAt >= LOG_RETENTION_MS;
}

export function formatLogsForClipboard(
	lines: readonly DeploymentLogLine[],
	formatTime: (iso: string) => string
): string {
	return lines
		.map((line) => {
			const stream = line.stream === 'stdout' ? '' : `${line.stream} `;
			return `[${formatTime(line.recorded_at)}] ${stream}${line.message}`;
		})
		.join('\n');
}

export type DeploymentLogErrorConfig = {
	description: string;
	showRetry: boolean;
};

export function getDeploymentLogErrorConfig(error: unknown): DeploymentLogErrorConfig {
	if (error instanceof NetworkError) {
		return {
			description: 'Koneksi ke server terputus, jadi log belum bisa dimuat. Periksa koneksimu.',
			showRetry: true
		};
	}

	if (error instanceof ApiError) {
		if (error.isForbidden) {
			return {
				description: 'Kamu tidak memiliki akses untuk melihat log deployment ini.',
				showRetry: false
			};
		}
		if (error.status === 404) {
			return { description: 'Log deployment ini tidak ditemukan.', showRetry: false };
		}
		if (error.isRateLimited) return { description: error.message, showRetry: true };
		if (error.isServerError) {
			return {
				description: 'Server gagal mengirim log. Deployment-nya sendiri tidak terpengaruh.',
				showRetry: true
			};
		}
	}

	return { description: 'Log belum bisa dimuat.', showRetry: true };
}

export function shouldRetryLogRequest(failureCount: number, error: unknown): boolean {
	if (error instanceof ApiError && error.status < 500 && !error.isRateLimited) return false;
	return failureCount < 2;
}

export function logRetryDelay(failureCount: number, error: unknown): number {
	if (error instanceof ApiError && error.isRateLimited) {
		return error.retryAfterSeconds !== undefined
			? error.retryAfterSeconds * 1_000
			: DEFAULT_RATE_LIMIT_WAIT_MS;
	}
	return Math.min(1_000 * 2 ** failureCount, 8_000);
}

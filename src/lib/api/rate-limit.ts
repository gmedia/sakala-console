import { ApiError } from './errors';

/** Used when CORS or a proxy hides `Retry-After`. */
export const DEFAULT_RATE_LIMIT_WAIT_MS = 30_000;

// The limit is per user, so another tab of the same browser is told to wait as well.
const STORAGE_KEY = 'sakala_rate_limited_until';

let blockedUntil = 0;

function readStored(): number {
	try {
		return Number(globalThis.localStorage?.getItem(STORAGE_KEY)) || 0;
	} catch {
		return 0;
	}
}

export function noteRateLimited(retryAfterSeconds: number | undefined): void {
	const waitMs =
		retryAfterSeconds !== undefined ? retryAfterSeconds * 1_000 : DEFAULT_RATE_LIMIT_WAIT_MS;
	blockedUntil = Math.max(blockedUntil, Date.now() + waitMs);
	try {
		globalThis.localStorage?.setItem(STORAGE_KEY, String(blockedUntil));
	} catch {
		// Only the other tabs lose out, and they will get their own 429.
	}
}

/** Seconds left to stay away. A read during this time would only extend the limit. */
export function rateLimitRemainingSeconds(): number {
	const remaining = Math.max(blockedUntil, readStored()) - Date.now();
	return remaining > 0 ? Math.ceil(remaining / 1_000) : 0;
}

export function resetRateLimit(): void {
	blockedUntil = 0;
	try {
		globalThis.localStorage?.removeItem(STORAGE_KEY);
	} catch {
		// Nothing was stored, then.
	}
}

/** A 429 says how long to stay away, and polling on schedule would only extend it. */
export function rateLimitWait(error: unknown): number | undefined {
	if (!(error instanceof ApiError) || !error.isRateLimited) return undefined;
	return error.retryAfterSeconds !== undefined
		? error.retryAfterSeconds * 1_000
		: DEFAULT_RATE_LIMIT_WAIT_MS;
}

/** Waiting is the answer to a 429, and the interval or the screen does that, not a quick retry. */
export function isRateLimitError(error: unknown): boolean {
	return error instanceof ApiError && error.isRateLimited;
}

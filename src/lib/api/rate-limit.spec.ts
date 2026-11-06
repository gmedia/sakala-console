import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './errors';
import {
	DEFAULT_RATE_LIMIT_WAIT_MS,
	noteRateLimited,
	rateLimitRemainingSeconds,
	rateLimitWait,
	resetRateLimit
} from './rate-limit';

describe('rate limit gate', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		resetRateLimit();
	});

	afterEach(() => {
		resetRateLimit();
		vi.useRealTimers();
	});

	it('is open until a 429 arrives', () => {
		expect(rateLimitRemainingSeconds()).toBe(0);
	});

	it('stays closed for as long as Retry-After says', () => {
		noteRateLimited(30);
		expect(rateLimitRemainingSeconds()).toBe(30);

		vi.advanceTimersByTime(29_000);
		expect(rateLimitRemainingSeconds()).toBe(1);

		vi.advanceTimersByTime(1_000);
		expect(rateLimitRemainingSeconds()).toBe(0);
	});

	it('waits a default time when the header is hidden', () => {
		noteRateLimited(undefined);
		expect(rateLimitRemainingSeconds()).toBe(DEFAULT_RATE_LIMIT_WAIT_MS / 1_000);
	});

	it('does not shorten a longer wait', () => {
		noteRateLimited(60);
		noteRateLimited(5);
		expect(rateLimitRemainingSeconds()).toBe(60);
	});
});

describe('rateLimitWait', () => {
	it('reads the wait from a 429', () => {
		const error = new ApiError('x', 429, {}, undefined, { retryAfterSeconds: 12 });
		expect(rateLimitWait(error)).toBe(12_000);
	});

	it('has nothing to say about other errors', () => {
		expect(rateLimitWait(new ApiError('x', 500))).toBeUndefined();
		expect(rateLimitWait(undefined)).toBeUndefined();
	});
});

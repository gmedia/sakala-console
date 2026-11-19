import { describe, expect, it } from 'vitest';
import { ApiError, NetworkError } from '$lib/api/errors';
import {
	emailCategoryLabel,
	isCompleteUnsubscribeLink,
	unsubscribeOutcome,
	unsubscribeOutcomeCopy
} from './unsubscribe';

describe('unsubscribe links', () => {
	it('names the three email categories in Indonesian, and nothing else', () => {
		expect(emailCategoryLabel('deployment_failure')).toBe('Deployment gagal');
		expect(emailCategoryLabel('workspace')).toBeNull();
		expect(emailCategoryLabel(null)).toBeNull();
	});

	it('needs the category, the user, and the signature', () => {
		expect(isCompleteUnsubscribeLink(new URLSearchParams('category=a&user=1&signature=x'))).toBe(
			true
		);
		expect(isCompleteUnsubscribeLink(new URLSearchParams('category=a&user=1'))).toBe(false);
	});

	it.each([
		[new ApiError('Invalid signature.', 403), 'invalid'],
		[new ApiError('Not found', 404), 'account_deleted'],
		[new ApiError('Invalid', 422), 'not_emailed'],
		[new ApiError('Too Many Attempts.', 429), 'rate_limited'],
		[new NetworkError(), 'offline'],
		[new ApiError('Server Error', 500), 'unknown']
	])('reads %s as %s', (error, kind) => {
		const outcome = unsubscribeOutcome(error);
		expect(outcome.kind).toBe(kind);
		expect(unsubscribeOutcomeCopy(outcome).title).not.toBe('');
	});

	it('says when to try again after a rate limit', () => {
		const error = new ApiError('Too Many Attempts.', 429, {}, undefined, { retryAfterSeconds: 30 });
		expect(unsubscribeOutcomeCopy(unsubscribeOutcome(error)).description).toContain('30 detik');
	});
});

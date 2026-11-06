import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	consumeSessionEndedNotice,
	forgetSession,
	noteSessionEnded,
	rememberSession
} from './session-notice';

describe('session ended notice', () => {
	beforeEach(() => {
		const store = new Map<string, string>();
		vi.stubGlobal('localStorage', {
			getItem: (key: string) => store.get(key) ?? null,
			setItem: (key: string, value: string) => store.set(key, value),
			removeItem: (key: string) => store.delete(key)
		});
		forgetSession();
	});

	it('is shown after a session this browser had, once', () => {
		rememberSession();
		noteSessionEnded();

		expect(consumeSessionEndedNotice()).toBe(true);
		expect(consumeSessionEndedNotice()).toBe(false);
	});

	it('is not shown to someone who never had a session', () => {
		noteSessionEnded();

		expect(consumeSessionEndedNotice()).toBe(false);
	});

	it('is not shown after logging out', () => {
		rememberSession();
		forgetSession();
		noteSessionEnded();

		expect(consumeSessionEndedNotice()).toBe(false);
	});
});

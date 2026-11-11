import { describe, expect, it } from 'vitest';
import { notificationPollInterval } from './queries';

describe('notificationPollInterval', () => {
	it('polls every minute without realtime, and rarely when it is connected', () => {
		for (const status of ['idle', 'connecting', 'disconnected', 'unavailable', 'failed'] as const) {
			expect(notificationPollInterval(status)).toBe(60_000);
		}
		expect(notificationPollInterval('connected')).toBe(300_000);
	});
});

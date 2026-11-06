import { describe, expect, it } from 'vitest';
import { formatClockTime, formatDateTime, formatDuration } from './date';

describe('formatClockTime', () => {
	it('separates with colons, not the dots of the id-ID locale (U-77)', () => {
		expect(formatClockTime(new Date(2026, 8, 13, 8, 1, 2))).toBe('08:01:02');
	});

	it('writes midnight as 00, not 24', () => {
		expect(formatClockTime(new Date(2026, 8, 13, 0, 5, 0))).toBe('00:05:00');
	});
});

describe('formatDateTime', () => {
	const now = new Date(2026, 8, 13, 12, 0, 0);

	it('shows the clock alone for today', () => {
		expect(formatDateTime(new Date(2026, 8, 13, 0, 0, 1), now)).toBe('00:00:01');
	});

	it('adds the date for yesterday, even within 24 hours', () => {
		expect(formatDateTime(new Date(2026, 8, 12, 23, 0, 0), now)).toBe('12 Sep 2026 23:00:00');
	});
});

describe('formatDuration', () => {
	it.each([
		[0, '0 detik'],
		[47, '47 detik'],
		[60, '1 menit'],
		[125, '2 menit 5 detik'],
		[3600, '1 jam'],
		[3780, '1 jam 3 menit'],
		[-5, '0 detik']
	])('%i seconds reads as %s', (seconds, expected) => {
		expect(formatDuration(seconds)).toBe(expected);
	});
});

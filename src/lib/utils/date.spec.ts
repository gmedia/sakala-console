import { describe, expect, it } from 'vitest';
import { formatClockTime, formatDateTime, formatDuration, formatRelativeTime } from './date';

describe('formatClockTime', () => {
	it('separates with colons, not the dots of the id-ID locale', () => {
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

describe('formatRelativeTime', () => {
	const NOW = Date.parse('2026-10-10T12:00:00Z');

	it.each([
		['2026-10-10T11:59:40Z', 'Baru saja'],
		['2026-10-10T11:55:00Z', '5 menit yang lalu'],
		['2026-10-10T09:00:00Z', '3 jam yang lalu'],
		['2026-10-09T12:00:00Z', 'Kemarin'],
		['2026-10-07T12:00:00Z', '3 hari yang lalu']
	])('%s reads as "%s"', (date, expected) => {
		expect(formatRelativeTime(date, NOW)).toBe(expected);
	});

	it('shows the date after a week', () => {
		expect(formatRelativeTime('2026-09-01T12:00:00Z', NOW)).toContain('2026');
	});

	it('shows nothing rather than a made-up time when the date is missing or broken', () => {
		expect(formatRelativeTime(null, NOW)).toBe('');
		expect(formatRelativeTime('bukan tanggal', NOW)).toBe('');
	});
});

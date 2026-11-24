import { describe, expect, it } from 'vitest';
import { formatZonedTime, isKnownTimezone, timezoneAbbreviation } from './time';

const SLOT = '2026-11-24T19:30:00Z';

describe('zoned times', () => {
	it('shows a UTC instant in the schedule zone, with the zone named', () => {
		expect(formatZonedTime(SLOT, 'Asia/Jakarta')).toBe('Rab, 25 Nov 2026, 02.30 WIB');
		expect(formatZonedTime(SLOT, 'Asia/Makassar')).toBe('Rab, 25 Nov 2026, 03.30 WITA');
		expect(formatZonedTime(SLOT, 'UTC')).toBe('Sel, 24 Nov 2026, 19.30 UTC');
	});

	it('falls back to UTC for a zone the browser does not know', () => {
		expect(isKnownTimezone('Mars/Olympus')).toBe(false);
		expect(formatZonedTime(SLOT, 'Mars/Olympus')).toBe('Sel, 24 Nov 2026, 19.30 UTC');
		expect(timezoneAbbreviation('Mars/Olympus')).toBe('Mars/Olympus');
	});

	it('names the Indonesian zones by their short names', () => {
		expect(timezoneAbbreviation('Asia/Jakarta')).toBe('WIB');
		expect(timezoneAbbreviation('Asia/Jayapura')).toBe('WIT');
	});
});

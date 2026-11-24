/*
 * Schedule times arrive in UTC and are shown in the schedule's own timezone, WIB by default, with the
 * zone written next to them. Intl names the Indonesian zones itself (WIB, WITA, WIT).
 */

const LOCALE = 'id-ID';

/** Times that belong to no schedule, such as a worker's crash, are shown in WIB. */
export const DISPLAY_TIMEZONE = 'Asia/Jakarta';

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timezone: string): Intl.DateTimeFormat {
	let formatter = formatters.get(timezone);
	if (!formatter) {
		formatter = new Intl.DateTimeFormat(LOCALE, {
			timeZone: timezone,
			weekday: 'short',
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			hourCycle: 'h23',
			timeZoneName: 'short'
		});
		formatters.set(timezone, formatter);
	}
	return formatter;
}

/** Whether the runtime knows the zone; the API refuses unknown ones too. */
export function isKnownTimezone(timezone: string): boolean {
	try {
		formatterFor(timezone);
		return true;
	} catch {
		return false;
	}
}

/** `Rab, 25 Nov 2026, 02.30 WIB`. Falls back to UTC for a zone this browser does not know. */
export function formatZonedTime(value: string | Date, timezone: string): string {
	const date = typeof value === 'string' ? new Date(value) : value;
	return (isKnownTimezone(timezone) ? formatterFor(timezone) : formatterFor('UTC')).format(date);
}

/** `WIB`, `WITA`, `UTC`, or `GMT+1` for a zone without a short Indonesian name. */
export function timezoneAbbreviation(timezone: string, at: Date = new Date()): string {
	if (!isKnownTimezone(timezone)) return timezone;
	return (
		formatterFor(timezone)
			.formatToParts(at)
			.find((part) => part.type === 'timeZoneName')?.value ?? timezone
	);
}

export function formatDate(date: string): string {
	return new Date(date).toLocaleDateString('id-ID', {
		month: 'long',
		day: 'numeric',
		year: 'numeric'
	});
}

const relativeFormat = new Intl.RelativeTimeFormat('id-ID');
const yesterdayFormat = new Intl.RelativeTimeFormat('id-ID', { numeric: 'auto' });

function capitalize(text: string): string {
	return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The one way to say how long ago: relative for a week, then the date. `Kemarin`, `3 jam yang lalu`. */
export function formatRelativeTime(
	date: string | null | undefined,
	now: number = Date.now()
): string {
	if (!date) return '';
	const time = new Date(date);
	const elapsed = now - time.getTime();
	if (Number.isNaN(elapsed)) return '';

	const minutes = Math.floor(elapsed / 60_000);
	if (minutes < 1) return 'Baru saja';
	if (minutes < 60) return relativeFormat.format(-minutes, 'minute');
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return relativeFormat.format(-hours, 'hour');
	const days = Math.floor(hours / 24);
	if (days === 1) return capitalize(yesterdayFormat.format(-1, 'day'));
	if (days < 7) return relativeFormat.format(-days, 'day');
	return shortDateFormat.format(time);
}

const clockFormat = new Intl.DateTimeFormat('id-ID', {
	hour: '2-digit',
	minute: '2-digit',
	second: '2-digit',
	hourCycle: 'h23'
});

const shortDateFormat = new Intl.DateTimeFormat('id-ID', {
	day: 'numeric',
	month: 'short',
	year: 'numeric'
});

/** `08:41:02`. The id-ID locale separates with dots, which reads as a decimal in a log. */
export function formatClockTime(date: string | Date): string {
	return clockFormat
		.formatToParts(new Date(date))
		.filter((part) => part.type !== 'literal')
		.map((part) => part.value)
		.join(':');
}

/** `08:41:02` for today, `20 Sep 2026 08:41:02` for any other day. */
export function formatDateTime(date: string | Date, now = new Date()): string {
	const value = new Date(date);
	const clock = formatClockTime(value);
	return value.toDateString() === now.toDateString()
		? clock
		: `${shortDateFormat.format(value)} ${clock}`;
}

/** `47 detik`, `2 menit 5 detik`, `1 jam 3 menit`. */
export function formatDuration(totalSeconds: number): string {
	const seconds = Math.max(0, Math.round(totalSeconds));
	if (seconds < 60) return `${seconds} detik`;

	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) {
		return seconds % 60 ? `${minutes} menit ${seconds % 60} detik` : `${minutes} menit`;
	}
	const hours = Math.floor(minutes / 60);
	return minutes % 60 ? `${hours} jam ${minutes % 60} menit` : `${hours} jam`;
}

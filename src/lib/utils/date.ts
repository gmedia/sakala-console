export function formatDate(date: string): string {
	return new Date(date).toLocaleDateString('id-ID', {
		month: 'long',
		day: 'numeric',
		year: 'numeric'
	});
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

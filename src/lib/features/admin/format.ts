import type { BadgeTone } from '$lib/components/ui/Badge.svelte';
import type { TimeRange } from '$lib/api/resources/admin/common';
import { ONBOARDING_SOURCE_OPTIONS_MAP } from '$lib/features/onboarding/constants';

/** Admin ranges are whole days in WIB, so every date on these pages is shown in WIB too. */
export const ADMIN_TIMEZONE = 'Asia/Jakarta';

type Label = { label: string; tone: BadgeTone };

function lookup<T extends Record<string, Label>>(map: T, value: string | null | undefined): Label {
	if (!value) return { label: 'Tidak diketahui', tone: 'neutral' };
	return map[value] ?? { label: value, tone: 'neutral' };
}

const RUNTIME_STATUS: Record<string, Label> = {
	running: { label: 'Live', tone: 'success' },
	deploying: { label: 'Men-deploy', tone: 'running' },
	failed: { label: 'Gagal', tone: 'error' },
	crashed: { label: 'Crash', tone: 'error' },
	stopped: { label: 'Berhenti', tone: 'muted' },
	not_deployed: { label: 'Belum deploy', tone: 'neutral' }
};

const PROJECT_STATUS: Record<string, Label> = {
	draft: { label: 'Draf', tone: 'neutral' },
	active: { label: 'Aktif', tone: 'success' },
	failed: { label: 'Gagal', tone: 'error' },
	suspended: { label: 'Ditangguhkan', tone: 'warning' }
};

const AGENT_STATUS: Record<string, Label> = {
	ready: { label: 'Siap', tone: 'success' },
	busy: { label: 'Sibuk', tone: 'running' },
	degraded: { label: 'Terganggu', tone: 'warning' },
	draining: { label: 'Mengosongkan', tone: 'queued' },
	drained: { label: 'Kosong', tone: 'muted' },
	maintenance: { label: 'Pemeliharaan', tone: 'queued' },
	offline: { label: 'Offline', tone: 'error' }
};

const AUTH_STATUS: Record<string, Label> = {
	active: { label: 'Token aktif', tone: 'success' },
	revoked: { label: 'Dicabut', tone: 'error' },
	suspended: { label: 'Ditangguhkan', tone: 'warning' }
};

const COMMAND_STATUS: Record<string, Label> = {
	Pending: { label: 'Mengantre', tone: 'queued' },
	Claimed: { label: 'Diambil node', tone: 'running' },
	Running: { label: 'Berjalan', tone: 'running' },
	Succeeded: { label: 'Berhasil', tone: 'success' },
	Failed: { label: 'Gagal', tone: 'error' },
	Cancelled: { label: 'Dibatalkan', tone: 'muted' },
	Expired: { label: 'Kedaluwarsa', tone: 'muted' }
};

const FEEDBACK_STATUS: Record<string, Label> = {
	open: { label: 'Baru', tone: 'queued' },
	acknowledged: { label: 'Ditindaklanjuti', tone: 'running' },
	resolved: { label: 'Selesai', tone: 'success' }
};

const DEPLOYMENT_STATUS: Record<string, Label> = {
	succeeded: { label: 'Berhasil', tone: 'success' },
	failed: { label: 'Gagal', tone: 'error' },
	cancelled: { label: 'Dibatalkan', tone: 'muted' },
	queued: { label: 'Mengantre', tone: 'queued' }
};

/** Anything still between queued and finished reads as deploying, like the member console. */
export const deploymentStatus = (value: string) =>
	DEPLOYMENT_STATUS[value] ?? { label: 'Men-deploy', tone: 'running' as BadgeTone };
export const runtimeStatus = (value: string) => lookup(RUNTIME_STATUS, value);
export const projectStatus = (value: string) => lookup(PROJECT_STATUS, value);
export const agentStatus = (value: string) => lookup(AGENT_STATUS, value);
export const authStatus = (value: string) => lookup(AUTH_STATUS, value);
export const commandStatus = (value: string) => lookup(COMMAND_STATUS, value);
export const feedbackStatus = (value: string) => lookup(FEEDBACK_STATUS, value);

export const RUNTIME_STATUS_OPTIONS = Object.entries(RUNTIME_STATUS).map(([value, { label }]) => ({
	value,
	label
}));
export const PROJECT_STATUS_OPTIONS = Object.entries(PROJECT_STATUS).map(([value, { label }]) => ({
	value,
	label
}));
export const AGENT_STATUS_OPTIONS = Object.entries(AGENT_STATUS).map(([value, { label }]) => ({
	value,
	label
}));
export const AUTH_STATUS_OPTIONS = Object.entries(AUTH_STATUS).map(([value, { label }]) => ({
	value,
	label
}));
export const COMMAND_STATUS_OPTIONS = Object.entries(COMMAND_STATUS).map(([value, { label }]) => ({
	value,
	label
}));
export const FEEDBACK_STATUS_OPTIONS = Object.entries(FEEDBACK_STATUS).map(
	([value, { label }]) => ({
		value,
		label
	})
);

/** Names and definitions of the API's failure categories (`DeploymentFailureCategory`). */
export const FAILURE_CATEGORIES: Record<string, { label: string; help: string }> = {
	checkout: { label: 'Checkout', help: 'Repository tidak bisa di-clone atau branch tidak ada.' },
	build: { label: 'Build', help: 'Install dependency, script build, atau Dockerfile gagal.' },
	start: {
		label: 'Start aplikasi',
		help: 'Container dibuat tetapi aplikasinya berhenti saat start.'
	},
	health: { label: 'Health check', help: 'Aplikasi jalan, tetapi tidak menjawab di port-nya.' },
	route: { label: 'Routing', help: 'Route publik ke aplikasi tidak bisa dipasang.' },
	timeout: { label: 'Timeout', help: 'Satu tahap melewati batas waktunya.' },
	resource: { label: 'Batas resource', help: 'Memori, CPU, atau disk tidak cukup.' },
	node: { label: 'Node runtime', help: 'Node yang menjalankan deployment bermasalah.' },
	scheduling: { label: 'Penjadwalan', help: 'Tidak ada node yang bisa menerima deployment.' },
	unknown: { label: 'Tidak diketahui', help: 'Kegagalan tanpa kode, atau kode yang belum dikenal.' }
};

export const FAILURE_CATEGORY_OPTIONS = Object.entries(FAILURE_CATEGORIES).map(
	([value, { label }]) => ({ value, label })
);

export function failureCategoryLabel(value: string): string {
	return FAILURE_CATEGORIES[value]?.label ?? value;
}

export const FEEDBACK_CATEGORIES: Record<string, string> = {
	general: 'Umum',
	bug: 'Bug',
	feature_request: 'Permintaan fitur',
	experience: 'Pengalaman',
	performance: 'Performa'
};

export const FEEDBACK_CATEGORY_OPTIONS = Object.entries(FEEDBACK_CATEGORIES).map(
	([value, label]) => ({ value, label })
);

export const ROLE_LABELS: Record<string, string> = { admin: 'Admin', user: 'Pengguna' };
export const WORKSPACE_TYPE_LABELS: Record<string, string> = { personal: 'Pribadi', team: 'Tim' };
export const MEMBER_ROLE_LABELS: Record<string, string> = {
	owner: 'Owner',
	member: 'Member',
	viewer: 'Viewer'
};

export function onboardingSourceLabel(source: string | null): string {
	if (source === null) return 'Belum menjawab';
	return (
		ONBOARDING_SOURCE_OPTIONS_MAP[source as keyof typeof ONBOARDING_SOURCE_OPTIONS_MAP] ?? source
	);
}

const numberFormat = new Intl.NumberFormat('id-ID');
const percentFormat = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

export function formatNumber(value: number): string {
	return numberFormat.format(value);
}

/** `42%`. Null when there is nothing to divide by, which the page says in words. */
export function formatShare(part: number, whole: number): string | null {
	if (whole <= 0) return null;
	return `${percentFormat.format((part / whole) * 100)}%`;
}

export type Trend = {
	direction: 'up' | 'down' | 'flat';
	/** `+18%`, or `dari 0` when the previous window was zero and this one is not. */
	text: string;
	/** Whether the change is good news: more failures is not. */
	good: boolean | null;
};

/** Change against the window of equal length just before. `higherIsBetter` decides the colour. */
export function trend(current: number, previous: number, higherIsBetter = true): Trend {
	if (current === previous) return { direction: 'flat', text: 'tetap', good: null };
	const direction = current > previous ? 'up' : 'down';
	const good = direction === 'up' ? higherIsBetter : !higherIsBetter;
	if (previous === 0) return { direction, text: 'dari 0', good };
	const change = ((current - previous) / previous) * 100;
	const sign = change > 0 ? '+' : '−';
	return { direction, text: `${sign}${percentFormat.format(Math.abs(change))}%`, good };
}

const dayFormat = new Intl.DateTimeFormat('id-ID', {
	day: 'numeric',
	month: 'short',
	year: 'numeric',
	timeZone: ADMIN_TIMEZONE
});

const shortDayFormat = new Intl.DateTimeFormat('id-ID', {
	day: 'numeric',
	month: 'short',
	timeZone: ADMIN_TIMEZONE
});

const clockFormat = new Intl.DateTimeFormat('id-ID', {
	hour: '2-digit',
	minute: '2-digit',
	hourCycle: 'h23',
	timeZone: ADMIN_TIMEZONE
});

/** `11 Nov 2026, 17.00 WIB`. Admins compare across days, so the date is always there. */
export function formatWibDateTime(iso: string | null | undefined): string {
	if (!iso) return '-';
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return '-';
	return `${dayFormat.format(date)}, ${clockFormat.format(date)} WIB`;
}

export function formatWibDate(iso: string | null | undefined): string {
	if (!iso) return '-';
	const date = new Date(iso);
	return Number.isNaN(date.getTime()) ? '-' : dayFormat.format(date);
}

/** `5 Nov 2026 – 11 Nov 2026`. `to` is exclusive, so the last day is the one before it. */
export function formatRange(range: Pick<TimeRange, 'from' | 'to'>): string {
	const lastDay = new Date(new Date(range.to).getTime() - 1);
	if (!range.from) return `Sampai ${dayFormat.format(lastDay)}`;
	return `${dayFormat.format(new Date(range.from))} – ${dayFormat.format(lastDay)}`;
}

export const RANGE_LABELS: Record<string, string> = {
	'7d': '7 hari terakhir',
	'30d': '30 hari terakhir',
	'90d': '90 hari terakhir',
	custom: 'Rentang khusus',
	all: 'Semua waktu'
};

export type GrowthBucket = { label: string; start: string; end: string; count: number };

/**
 * New users per day for a week or a month, per week beyond that, so 90 days stay readable as 13
 * columns. A week is labelled by its first day; the last one may be shorter, and says so in `end`.
 */
export function bucketGrowth(points: { date: string; count: number }[]): {
	unit: 'hari' | 'minggu';
	buckets: GrowthBucket[];
} {
	const toLabel = (date: string) => shortDayFormat.format(new Date(`${date}T00:00:00+07:00`));
	if (points.length <= 31) {
		return {
			unit: 'hari',
			buckets: points.map((point) => ({
				label: toLabel(point.date),
				start: point.date,
				end: point.date,
				count: point.count
			}))
		};
	}
	const buckets: GrowthBucket[] = [];
	for (let index = 0; index < points.length; index += 7) {
		const week = points.slice(index, index + 7);
		buckets.push({
			label: toLabel(week[0].date),
			start: week[0].date,
			end: week[week.length - 1].date,
			count: week.reduce((sum, point) => sum + point.count, 0)
		});
	}
	return { unit: 'minggu', buckets };
}

/** A node without a name, registered before names were required, goes by its agent ID. */
export function agentName(agent: { name: string | null; agent_id: string }): string {
	return agent.name ?? shortId(agent.agent_id);
}

/** `agent-01a1…e5582025` stays recognisable without taking a whole column. */
export function shortId(value: string, keep = 8): string {
	return value.length <= keep * 2 + 1 ? value : `${value.slice(0, keep)}…${value.slice(-keep)}`;
}

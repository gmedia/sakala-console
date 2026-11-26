import { ApiError, getErrorMessage, WORKLOAD_ERROR_CODES } from '$lib/api/errors';
import type { PilotLimits } from '$lib/api/resources/pilot-limits';
import {
	OPEN_SCHEDULE_RUN_STATUSES,
	SCHEDULE_HEALTH,
	SCHEDULE_PAUSE_REASONS,
	type KnownScheduleRunStatus,
	type ProjectSchedule,
	type SchedulePayload,
	type ScheduleRun
} from '$lib/api/resources/schedules';
import {
	parseWorkloadRefusal,
	SCHEDULE_RUN_REFUSAL_REASONS,
	type ScheduleRunRefusalReason
} from '$lib/api/resources/workload-refusals';
import type { BadgeTone } from '$lib/components/ui/Badge.svelte';
import { LARAVEL_FRAMEWORK } from '$lib/features/projects/build-help';
import { formatDuration } from '$lib/utils/date';
import { checkCronExpression, shortestCronGapMinutes } from './cron';
import { commandError, parseWholeNumber, SCHEDULE_RULES } from './rules';

const MINUTES_PER_HOUR = 60;
const MS_PER_SECOND = 1000;

export const SCHEDULE_COPY = {
	section: 'Jadwal',
	/** One line under the title; the full explanation sits behind "Pelajari". */
	intro: 'Perintah sekali jalan pada waktu tertentu.',
	introLearn:
		'Menjalankan perintah sekali jalan pada waktu tertentu, dari image deployment yang sedang live. Run dimulai sekitar satu menit setelah waktunya dan tidak membangunkan proyek yang tidur.',
	create: 'Buat jadwal',
	createTitle: 'Buat jadwal',
	editTitle: 'Ubah jadwal',
	save: 'Simpan jadwal',
	saving: 'Menyimpan...',
	cancel: 'Batal',
	pause: 'Jeda',
	resume: 'Aktifkan lagi',
	delete: 'Hapus jadwal',
	deleteTitle: (name: string) => `Hapus jadwal ${name}?`,
	deleteDescription:
		'Jadwal dan riwayat run-nya dihapus. Run yang sedang berjalan dihentikan dulu. Tindakan ini tidak bisa dibatalkan.',
	runNow: 'Jalankan sekarang',
	running: 'Menjalankan...',
	stopRun: 'Hentikan run',
	stopping: 'Menghentikan...',
	viewLog: 'Lihat log',
	hideLog: 'Tutup log',
	history: 'Riwayat run',
	historyEmpty:
		'Belum ada run. Run pertama tercatat pada waktu berikutnya, atau tekan Jalankan sekarang.',
	loadMore: 'Muat run sebelumnya',
	historyKept: 'Sakala menyimpan 100 run terakhir setiap jadwal, dan log-nya selama 7 hari.',
	nameLabel: 'Nama',
	commandLabel: 'Perintah',
	/** The one line under the field; the full rule is `commandLearn`, behind "Pelajari". */
	commandHint: 'Harus selesai sendiri.',
	commandLearn:
		'Dijalankan sekali dengan sh -c di container baru dari image yang live, dengan variabel proyek. Harus selesai sendiri.',
	whenLabel: 'Kapan',
	presetsLabel: 'Pilihan cepat',
	customPreset: 'Kustom',
	expressionLabel: 'Ekspresi cron',
	/** The preview under the field reads the expression back, so the hint is an example only. */
	expressionHint: 'Contoh: 30 2 * * *.',
	expressionLearn:
		'Lima bagian: menit, jam, tanggal, bulan, hari. Contoh 30 2 * * * untuk setiap hari pukul 02.30.',
	/** The "Pelajari" at the end of the form's first two sections. */
	formLearnTopic: 'perintah dan ekspresi cron',
	previewTitle: 'Tiga run berikutnya',
	previewNone: 'Ekspresi ini tidak pernah jatuh tempo.',
	advancedToggle: 'Zona waktu dan batas waktu',
	timezoneLabel: 'Zona waktu',
	timezoneHint: 'Ekspresi cron dibaca di zona ini, dan waktunya ditampilkan di zona ini.',
	timeoutLabel: 'Batas waktu run (detik)',
	timeoutFact: 'Batas waktu run',
	seconds: (value: number) => `${value} detik`,
	timeoutHint: (max: number) =>
		`Run yang lebih lama dihentikan dan dicatat melewati batas waktu. Paling lama ${max} detik.`,
	enabledLabel: 'Aktif',
	enabledHint: 'Jadwal nonaktif tetap tersimpan, tidak berjalan, dan tidak dihitung dalam kuota.',
	nextRun: 'Run berikutnya',
	lastRun: 'Run terakhir',
	noRunYet: 'Belum pernah berjalan',
	notScheduled: 'Tidak dijadwalkan',
	manualRun: (time: string) => `Dijalankan manual, ${time}`,
	scheduledRun: (time: string) => `Dijadwalkan ${time}`,
	stopped: 'Run dihentikan.',
	runStartedAt: 'Mulai',
	runDuration: 'Durasi',
	runExitCode: 'Kode keluar',
	emptyTitle: 'Belum ada jadwal',
	emptyDescription:
		'Buat jadwal untuk laporan harian, pembersihan data, atau pengingat. Job harus aman dilewati dan aman dijalankan ulang.',
	suggestionTitle: 'Saran untuk Laravel',
	suggestionUse: 'Pakai saran ini',
	created: (name: string) => `Jadwal ${name} dibuat.`,
	updated: (name: string) => `Jadwal ${name} tersimpan.`,
	deleted: (name: string) => `Jadwal ${name} dihapus.`,
	paused: (name: string) => `Jadwal ${name} dijeda.`,
	resumed: (name: string) => `Jadwal ${name} aktif lagi.`,
	runStarted: 'Run dimulai. Statusnya diperbarui di riwayat.',
	runWaiting:
		'Run menunggu giliran karena workspace sedang menjalankan job sebanyak batasnya. Run mulai setelah ada yang selesai.',
	stopRequested: 'Sakala sedang menghentikan run ini di server.',
	readOnly: 'Jadwal hanya bisa diubah pemilik dan anggota workspace.',
	loadFailed: 'Jadwal belum bisa dimuat. Muat ulang halaman ini.',
	unavailable: 'Jadwal belum bisa dipakai di instalasi Sakala ini.',
	notFoundHint: 'Buka bagian Jadwal di Pengaturan untuk melihat jadwal yang ada.',
	loading: 'Memuat...',
	notFound: 'Jadwal ini tidak ditemukan. Mungkin sudah dihapus.',
	saveFailed: 'Jadwal belum tersimpan. Periksa isiannya, lalu simpan lagi.',
	deleteFailed: 'Jadwal belum terhapus. Muat ulang halaman, lalu hapus lagi.',
	runFailed: 'Run belum bisa dimulai. Muat ulang halaman, lalu coba lagi.',
	stopFailed: 'Run belum bisa dihentikan. Muat ulang halaman, lalu coba lagi.',
	stopNotOpen: 'Run ini sudah selesai, jadi tidak perlu dihentikan.',
	logEmpty: 'Run ini tidak menulis apa pun ke log.',
	logNotRun: 'Run ini tidak pernah berjalan, jadi tidak punya log.',
	logLoadMore: 'Muat baris berikutnya',
	logFailed: 'Log run belum bisa dimuat. Coba lagi sebentar lagi.',
	backToSettings: 'Kembali ke Pengaturan',
	dstNote:
		'Zona ini memakai jam musim panas, jadi saat jam bergeser satu run bisa terlewat atau berjalan dua kali.'
} as const;

/** How a run status reads: a label and a badge tone, never colour alone. */
export type RunStatusView = { label: string; tone: BadgeTone; open: boolean };

const RUN_STATUS_VIEWS: Record<KnownScheduleRunStatus, Omit<RunStatusView, 'open'>> = {
	waiting: { label: 'Menunggu giliran', tone: 'queued' },
	queued: { label: 'Mengantre', tone: 'queued' },
	running: { label: 'Berjalan', tone: 'running' },
	succeeded: { label: 'Berhasil', tone: 'success' },
	failed: { label: 'Gagal', tone: 'error' },
	timed_out: { label: 'Melewati batas waktu', tone: 'error' },
	cancelled: { label: 'Dihentikan', tone: 'muted' },
	lost: { label: 'Terputus', tone: 'error' },
	missed: { label: 'Terlewat', tone: 'warning' },
	skipped: { label: 'Dilewati', tone: 'muted' }
};

/** What `lost` means, which the API sends no sentence for when the run has no failure code. */
const LOST_EXPLANATION =
	'Server berhenti melapor saat run ini berjalan, jadi hasilnya tidak diketahui.';

export function runStatusView(status: string): RunStatusView {
	const known = RUN_STATUS_VIEWS[status as KnownScheduleRunStatus];
	return {
		label: known?.label ?? status,
		tone: known?.tone ?? 'neutral',
		open: isOpenRun(status)
	};
}

export function isOpenRun(status: string): boolean {
	return OPEN_SCHEDULE_RUN_STATUSES.includes(status);
}

/** The sentence under a run: why it failed, was skipped, missed, or waits. API words first. */
export function runExplanation(
	run: Pick<ScheduleRun, 'status' | 'error_summary' | 'reason_message'>
) {
	return (
		run.error_summary ?? run.reason_message ?? (run.status === 'lost' ? LOST_EXPLANATION : null)
	);
}

/** `2 detik`, `5 menit`, or `null` before the node reports an end. */
export function runDurationText(durationMs: number | null): string | null {
	if (durationMs === null) return null;
	return formatDuration(durationMs / MS_PER_SECOND);
}

/** Whether the run started a container, so it can have output. */
export function runHasOutput(run: Pick<ScheduleRun, 'started_at' | 'duration_ms'>): boolean {
	return run.started_at !== null || run.duration_ms !== null;
}

export type ScheduleStateView = {
	key: 'paused' | 'disabled' | 'failing' | 'active';
	label: string;
	tone: BadgeTone;
};

/** Paused by Sakala after failures outranks a plain switch-off, which outranks a failing streak. */
export function scheduleStateView(
	schedule: Pick<
		ProjectSchedule,
		'enabled' | 'paused_at' | 'pause_reason' | 'health' | 'consecutive_failures'
	>
): ScheduleStateView {
	if (!schedule.enabled && schedule.paused_at) {
		return { key: 'paused', label: 'Dijeda otomatis', tone: 'error' };
	}
	if (!schedule.enabled) return { key: 'disabled', label: 'Nonaktif', tone: 'muted' };
	if (schedule.health === SCHEDULE_HEALTH.failing) {
		return {
			key: 'failing',
			label: `Gagal ${schedule.consecutive_failures} kali berturut-turut`,
			tone: 'warning'
		};
	}
	return { key: 'active', label: 'Aktif', tone: 'success' };
}

/** The notice of a schedule Sakala paused itself, and how to get it running again. */
export function pausedNotice(
	schedule: Pick<ProjectSchedule, 'pause_reason' | 'consecutive_failures'>,
	pausedAt: string
): string {
	const why =
		schedule.pause_reason === SCHEDULE_PAUSE_REASONS.consecutiveFailures
			? `setelah ${schedule.consecutive_failures} run gagal berturut-turut`
			: 'oleh Sakala';
	return `Sakala menjeda jadwal ini ${why}, pada ${pausedAt}. Buka log run yang gagal, perbaiki perintah atau aplikasinya, lalu tekan Aktifkan lagi. Hitungan gagalnya mulai dari nol lagi.`;
}

/** `15 menit`, `1 jam`, `1 jam 30 menit`. */
export function intervalText(minutes: number): string {
	if (minutes < MINUTES_PER_HOUR) return `${minutes} menit`;
	const hours = Math.floor(minutes / MINUTES_PER_HOUR);
	const rest = minutes % MINUTES_PER_HOUR;
	return rest ? `${hours} jam ${rest} menit` : `${hours} jam`;
}

/* ---------------------------------------------------------------------------------------------- */
/* Presets                                                                                        */
/* ---------------------------------------------------------------------------------------------- */

/** Hour of the daily and weekly presets: night, when few people use the app. */
export const PRESET_NIGHT_HOUR = 2;
/** Monday, in cron's day-of-week numbering. */
const PRESET_WEEKDAY = 1;

export const CRON_PRESET_IDS = {
	interval: 'interval',
	hourly: 'hourly',
	daily: 'daily',
	weekly: 'weekly',
	/** Not a preset: the expression typed by hand. */
	custom: 'custom'
} as const;

export type CronPreset = { id: string; label: string; expression: string };

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * A minute from 1 to 59 for the hourly, daily, and weekly presets, so schedules do not all start
 * at minute 0 (ADR-022). Picked once when a form opens.
 */
export function randomPresetMinute(random: () => number = Math.random): number {
	return 1 + Math.floor(random() * (MINUTES_PER_HOUR - 1));
}

/**
 * The common choices, each a plain expression the field shows. The shortest one runs at the
 * workspace's minimum interval when that divides an hour, so the list never offers what the API
 * would refuse.
 */
export function cronPresets(minIntervalMinutes: number, minute: number): CronPreset[] {
	const time = `${pad(PRESET_NIGHT_HOUR)}.${pad(minute)}`;
	const presets: CronPreset[] = [];
	if (minIntervalMinutes < MINUTES_PER_HOUR && MINUTES_PER_HOUR % minIntervalMinutes === 0) {
		presets.push({
			id: CRON_PRESET_IDS.interval,
			label: `Setiap ${minIntervalMinutes} menit`,
			expression: `*/${minIntervalMinutes} * * * *`
		});
	}
	if (minIntervalMinutes <= MINUTES_PER_HOUR) {
		presets.push({
			id: CRON_PRESET_IDS.hourly,
			label: `Setiap jam pada menit ${pad(minute)}`,
			expression: `${minute} * * * *`
		});
	}
	presets.push(
		{
			id: CRON_PRESET_IDS.daily,
			label: `Setiap hari pukul ${time}`,
			expression: `${minute} ${PRESET_NIGHT_HOUR} * * *`
		},
		{
			id: CRON_PRESET_IDS.weekly,
			label: `Setiap Senin pukul ${time}`,
			expression: `${minute} ${PRESET_NIGHT_HOUR} * * ${PRESET_WEEKDAY}`
		}
	);
	return presets;
}

/** The Indonesian zones first, then UTC; a schedule saved with another zone keeps it. */
export const TIMEZONE_OPTIONS = [
	{ value: 'Asia/Jakarta', label: 'WIB (Asia/Jakarta)' },
	{ value: 'Asia/Makassar', label: 'WITA (Asia/Makassar)' },
	{ value: 'Asia/Jayapura', label: 'WIT (Asia/Jayapura)' },
	{ value: 'UTC', label: 'UTC' }
] as const;

/** The Indonesian zones and UTC have no daylight saving time; any other zone gets a note. */
export function hasDaylightSavingRisk(timezone: string): boolean {
	return !TIMEZONE_OPTIONS.some((option) => option.value === timezone);
}

/* ---------------------------------------------------------------------------------------------- */
/* Form                                                                                           */
/* ---------------------------------------------------------------------------------------------- */

export type ScheduleDraft = {
	name: string;
	command: string;
	cron_expression: string;
	timezone: string;
	timeout_seconds: string;
	enabled: boolean;
};

export type ScheduleDraftErrors = Partial<Record<Exclude<keyof ScheduleDraft, 'enabled'>, string>>;

export type ScheduleLimits = {
	minIntervalMinutes: number;
	maxTimeoutSeconds: number;
	defaultTimeoutSeconds: number;
	defaultTimezone: string;
	maxSchedules?: number;
	currentSchedules?: number;
};

export function scheduleLimits(limits: PilotLimits | undefined): ScheduleLimits {
	return {
		minIntervalMinutes:
			limits?.quotas.min_schedule_interval_minutes ?? SCHEDULE_RULES.defaultMinIntervalMinutes,
		maxTimeoutSeconds: limits?.schedules?.max_timeout_seconds ?? SCHEDULE_RULES.maxTimeoutSeconds,
		defaultTimeoutSeconds:
			limits?.schedules?.default_timeout_seconds ?? SCHEDULE_RULES.defaultTimeoutSeconds,
		defaultTimezone: limits?.schedules?.default_timezone ?? SCHEDULE_RULES.defaultTimezone,
		maxSchedules: limits?.quotas.max_schedules,
		currentSchedules: limits?.quotas.current_schedules_count
	};
}

/** Whether one more enabled schedule would pass the workspace's limit. */
export function isScheduleQuotaFull(limits: ScheduleLimits): boolean {
	return (
		limits.maxSchedules !== undefined &&
		limits.currentSchedules !== undefined &&
		limits.currentSchedules >= limits.maxSchedules
	);
}

export function scheduleQuotaText(limits: ScheduleLimits): string | null {
	if (limits.maxSchedules === undefined) return null;
	if (limits.maxSchedules === 0) {
		return 'Workspace ini belum bisa menjalankan jadwal. Jadwal tetap bisa disimpan nonaktif, atau minta admin Sakala membuka batasnya.';
	}
	return `${limits.currentSchedules ?? 0} dari ${limits.maxSchedules} jadwal aktif di workspace ini terpakai. Jarak antar-run paling dekat ${intervalText(limits.minIntervalMinutes)}.`;
}

export function emptyScheduleDraft(limits: ScheduleLimits, expression: string): ScheduleDraft {
	return {
		name: '',
		command: '',
		cron_expression: expression,
		timezone: limits.defaultTimezone,
		timeout_seconds: String(limits.defaultTimeoutSeconds),
		// A workspace at its limit gets a disabled schedule instead of a refusal.
		enabled: !isScheduleQuotaFull(limits)
	};
}

export function scheduleDraftFrom(schedule: ProjectSchedule): ScheduleDraft {
	return {
		name: schedule.name,
		command: schedule.command,
		cron_expression: schedule.cron_expression,
		timezone: schedule.timezone,
		timeout_seconds: String(schedule.timeout_seconds),
		enabled: schedule.enabled
	};
}

export const CRON_ERRORS = {
	empty: 'Isi ekspresi cron, atau pilih salah satu pilihan cepat.',
	shape:
		'Ekspresi cron harus lima bagian: menit, jam, tanggal, bulan, dan hari, misalnya 30 2 * * * untuk setiap hari pukul 02.30.',
	macro: 'Singkatan seperti @daily belum didukung. Tulis lima bagiannya, misalnya 0 0 * * *.',
	never: SCHEDULE_COPY.previewNone,
	tooFrequent: (minutes: number) =>
		`Jadwal di workspace ini paling sering berjalan setiap ${intervalText(minutes)}. Pilih ekspresi cron dengan jarak antar-run paling sedikit ${intervalText(minutes)}.`
} as const;

export function cronError(
	expression: string,
	timezone: string,
	minIntervalMinutes: number,
	from: Date = new Date()
): string | undefined {
	const check = checkCronExpression(expression);
	if (!check.valid) {
		if (check.reason === 'empty') return CRON_ERRORS.empty;
		if (check.reason === 'macro') return CRON_ERRORS.macro;
		return CRON_ERRORS.shape;
	}
	const gap = shortestCronGapMinutes(check.expression, timezone, from);
	if (gap !== null && gap < minIntervalMinutes) return CRON_ERRORS.tooFrequent(minIntervalMinutes);
	return undefined;
}

/** What is wrong with a run's time limit typed as text, or `undefined` when the API would take it. */
export function timeoutError(value: string, limits: Pick<ScheduleLimits, 'maxTimeoutSeconds'>) {
	const timeout = parseWholeNumber(value);
	return timeout === null ||
		Number.isNaN(timeout) ||
		timeout < SCHEDULE_RULES.minTimeoutSeconds ||
		timeout > limits.maxTimeoutSeconds
		? `Batas waktu run antara ${SCHEDULE_RULES.minTimeoutSeconds} dan ${limits.maxTimeoutSeconds} detik.`
		: undefined;
}

export function scheduleDraftErrors(
	draft: ScheduleDraft,
	limits: ScheduleLimits,
	from: Date = new Date()
): ScheduleDraftErrors {
	const name = draft.name.trim();
	return {
		name: !name
			? 'Isi nama jadwal, misalnya Laporan harian.'
			: name.length > SCHEDULE_RULES.nameMaxLength
				? `Nama jadwal paling panjang ${SCHEDULE_RULES.nameMaxLength} karakter.`
				: undefined,
		command: commandError(draft.command, 'jadwal'),
		cron_expression: cronError(
			draft.cron_expression,
			draft.timezone,
			limits.minIntervalMinutes,
			from
		),
		timezone: draft.timezone.trim() ? undefined : 'Pilih zona waktu.',
		timeout_seconds: timeoutError(draft.timeout_seconds, limits)
	};
}

export function hasScheduleDraftErrors(errors: ScheduleDraftErrors): boolean {
	return Object.values(errors).some(Boolean);
}

export function scheduleErrorsFromApi(errors: Record<string, string[]>): ScheduleDraftErrors {
	return {
		name: errors.name?.[0],
		command: errors.command?.[0],
		cron_expression: errors.cron_expression?.[0],
		timezone: errors.timezone?.[0],
		timeout_seconds: errors.timeout_seconds?.[0]
	};
}

export function schedulePayload(draft: ScheduleDraft): SchedulePayload {
	return {
		name: draft.name.trim(),
		command: draft.command.trim(),
		cron_expression: draft.cron_expression.trim().replace(/\s+/g, ' '),
		timezone: draft.timezone,
		timeout_seconds:
			parseWholeNumber(draft.timeout_seconds) ?? SCHEDULE_RULES.defaultTimeoutSeconds,
		enabled: draft.enabled
	};
}

/** Only what changed, for PATCH. */
export function scheduleChanges(
	draft: ScheduleDraft,
	schedule: ProjectSchedule
): Partial<SchedulePayload> {
	const next = schedulePayload(draft);
	return Object.fromEntries(
		Object.entries(next).filter(([key, value]) => schedule[key as keyof SchedulePayload] !== value)
	) as Partial<SchedulePayload>;
}

/**
 * What saving does to the quota: creating or enabling a schedule at the limit is refused with 422
 * `SCHEDULE_LIMIT_EXCEEDED`, which the API explains in its own words.
 */
export function scheduleSaveErrorMessage(error: unknown, fallback: string): string {
	if (error instanceof ApiError && error.code === WORKLOAD_ERROR_CODES.scheduleLimitExceeded) {
		const details = parseWorkloadRefusal(WORKLOAD_ERROR_CODES.scheduleLimitExceeded, error.details);
		if (details) {
			return `Workspace ini sudah punya ${details.current} jadwal aktif, dan batasnya ${details.limit}. Simpan jadwal ini nonaktif, atau nonaktifkan jadwal lain dulu.`;
		}
	}
	return getErrorMessage(error, fallback);
}

/** Run now refusals, by `reason`; each says what to do next. */
export const RUN_REFUSAL_MESSAGES: Record<ScheduleRunRefusalReason, string> = {
	[SCHEDULE_RUN_REFUSAL_REASONS.overlap]:
		'Jadwal ini masih punya run yang berjalan atau menunggu. Tunggu sampai selesai, atau hentikan run itu dulu di riwayat.',
	[SCHEDULE_RUN_REFUSAL_REASONS.projectSuspended]:
		'Proyek ini sedang ditangguhkan admin Sakala, jadi jadwalnya tidak bisa dijalankan.',
	[SCHEDULE_RUN_REFUSAL_REASONS.noLiveDeployment]:
		'Proyek ini belum punya deployment yang live, jadi belum ada image untuk dijalankan. Deploy proyek dulu, lalu jalankan jadwal ini lagi.',
	[SCHEDULE_RUN_REFUSAL_REASONS.nodeUnsupported]:
		'Server yang menjalankan proyek ini belum mendukung jadwal. Coba lagi setelah operator memperbarui agent di server.'
};

export type RunNowRefusal = { reason: ScheduleRunRefusalReason | null; message: string };

/** `null` for an error that is not a refusal: the caller shows the generic failure. */
export function runNowRefusal(error: unknown): RunNowRefusal | null {
	if (!(error instanceof ApiError) || error.code !== WORKLOAD_ERROR_CODES.scheduleRunRefused) {
		return null;
	}
	const reason = parseWorkloadRefusal(WORKLOAD_ERROR_CODES.scheduleRunRefused, error.details)
		?.reason as ScheduleRunRefusalReason | undefined;
	const known = reason && reason in RUN_REFUSAL_MESSAGES ? reason : null;
	return {
		reason: known,
		message: known ? RUN_REFUSAL_MESSAGES[known] : getErrorMessage(error, SCHEDULE_COPY.runFailed)
	};
}

export function isRunNotOpenError(error: unknown): boolean {
	return error instanceof ApiError && error.code === WORKLOAD_ERROR_CODES.scheduleRunNotOpen;
}

/* ---------------------------------------------------------------------------------------------- */
/* Suggestion                                                                                     */
/* ---------------------------------------------------------------------------------------------- */

/**
 * Laravel's scheduler, run as a schedule at the workspace's minimum interval (ADR-022). Laravel only
 * runs the tasks due in the minute `schedule:run` starts, which the form says.
 */
export const LARAVEL_SCHEDULER = {
	name: 'Laravel scheduler',
	command: 'php artisan schedule:run',
	note: 'Laravel hanya menjalankan task yang jatuh tempo pada menit perintah ini mulai. Atur task Laravel-mu di menit yang sama dengan jadwal ini.'
} as const;

export function scheduleSuggestion(
	framework: string | null | undefined,
	schedules: readonly Pick<ProjectSchedule, 'command'>[]
): typeof LARAVEL_SCHEDULER | null {
	if (framework !== LARAVEL_FRAMEWORK) return null;
	return schedules.some((schedule) => schedule.command.includes('schedule:run'))
		? null
		: LARAVEL_SCHEDULER;
}

/** The preset a suggestion uses: the shortest interval the workspace allows. */
export function suggestionExpression(minIntervalMinutes: number, minute: number): string {
	return cronPresets(minIntervalMinutes, minute)[0].expression;
}

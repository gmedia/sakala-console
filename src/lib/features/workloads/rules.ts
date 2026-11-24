/*
 * The input rules sakala-api applies to worker processes and schedules (ADR-022), checked in the
 * Console first so a mistake is explained before anything is sent. The API checks them again and
 * its answer wins.
 */

/** ProjectProcess::MAX_COMMAND_LENGTH, shared by workers, schedules, and the release command. */
export const COMMAND_MAX_LENGTH = 1000;

/** The API's `not_regex:/[\x00-\x1F\x7F]/`: a command is one line without control characters. */
// eslint-disable-next-line no-control-regex -- control characters are exactly what it looks for
const CONTROL_CHARACTERS = /[\x00-\x1F\x7F]/;

export const PROCESS_RULES = {
	/** ProjectProcess::MAX_NAME_LENGTH. */
	nameMaxLength: 30,
	/** ProjectProcess::NAME_PATTERN. */
	namePattern: /^[a-z][a-z0-9-]*$/,
	/** ProjectProcess::RESERVED_NAMES: the platform's own processes. */
	reservedNames: ['web', 'release', 'job'] as readonly string[],
	/** ProjectProcess::MAX_PER_PROJECT, configuration rather than a quota. */
	maxPerProject: 5,
	/** ProjectProcess::DEFAULT_REPLICAS. */
	defaultReplicas: 1,
	/** `0` keeps the definition and runs nothing. */
	minReplicas: 0
} as const;

/** The process names log lines carry for the platform's own output (DeploymentLogResource). */
export const WEB_PROCESS = 'web';
export const JOB_PROCESS = 'job';

export const SCHEDULE_RULES = {
	/** ProjectSchedule::MAX_NAME_LENGTH. */
	nameMaxLength: 100,
	/** SchedulePolicy::DEFAULT_TIMEOUT_SECONDS and MAX_TIMEOUT_SECONDS, also in pilot-limits. */
	defaultTimeoutSeconds: 300,
	maxTimeoutSeconds: 600,
	minTimeoutSeconds: 1,
	/** SchedulePolicy::DEFAULT_TIMEZONE: WIB. */
	defaultTimezone: 'Asia/Jakarta',
	/** The global default of `min_schedule_interval_minutes`, for an API that does not send it. */
	defaultMinIntervalMinutes: 15
} as const;

/** Whose command it is, as the API's messages name it. */
export type CommandSubject = 'worker' | 'jadwal';

export const COMMAND_ERRORS = {
	empty: 'Isi perintahnya, misalnya php artisan queue:work.',
	tooLong: `Perintah paling panjang ${COMMAND_MAX_LENGTH} karakter. Pindahkan langkah yang panjang ke script di repository.`,
	multiline: (subject: CommandSubject) =>
		`Perintah ${subject} harus satu baris. Gabungkan beberapa langkah dengan && atau pindahkan ke script di repository.`
} as const;

/** What is wrong with a command, or `undefined` when the API would take it. */
export function commandError(command: string, subject: CommandSubject): string | undefined {
	const trimmed = command.trim();
	if (!trimmed) return COMMAND_ERRORS.empty;
	if (trimmed.length > COMMAND_MAX_LENGTH) return COMMAND_ERRORS.tooLong;
	if (CONTROL_CHARACTERS.test(trimmed)) return COMMAND_ERRORS.multiline(subject);
	return undefined;
}

/** A whole number from a text field, or `null` when it is empty. `NaN` for anything else. */
export function parseWholeNumber(value: string): number | null {
	const trimmed = value.trim();
	if (!trimmed) return null;
	return /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}

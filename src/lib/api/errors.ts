const SAFE_MESSAGES: Record<number, string> = {
	401: 'Sesimu tidak ditemukan. Silakan masuk kembali.',
	403: 'Kamu tidak memiliki akses untuk melakukan tindakan ini.',
	419: 'Sesimu kedaluwarsa. Silakan muat ulang halaman dan coba lagi.',
	422: 'Data yang dikirim tidak valid'
};

/** Statuses the API uses for business refusals (quota, limit, suspended) when no `code` is sent yet. */
const BUSINESS_STATUSES = new Set([402, 403, 409, 422, 423]);

/** Laravel and Symfony defaults: they say nothing useful to a user, so the safe text wins. */
const FRAMEWORK_MESSAGES = new Set([
	'this action is unauthorized.',
	'unauthorized',
	'forbidden',
	'unauthenticated.',
	'not found',
	'server error',
	'too many attempts.',
	'too many requests',
	'csrf token mismatch.',
	'the given data was invalid.'
]);

const MAX_API_MESSAGE_LENGTH = 500;

/** A 503 from the API when GitHub limits Sakala. It passes by itself, and says how long it takes. */
const GITHUB_RATE_LIMITED = 'GITHUB_RATE_LIMITED';

/** A 503 that explains itself: this deployment cannot send email, so the API's words matter. */
const EMAIL_DELIVERY_UNAVAILABLE = 'EMAIL_DELIVERY_UNAVAILABLE';

/** Terms changed or were never accepted. Creating and deploying wait until they are. */
export const LEGAL_ACCEPTANCE_REQUIRED = 'LEGAL_ACCEPTANCE_REQUIRED';
/** An account without a password proves itself by logging in at its provider again. */
export const REAUTHENTICATION_REQUIRED = 'REAUTHENTICATION_REQUIRED';

export type ValidationErrors = Record<string, string[]>;

export type ApiErrorMeta = {
	code?: string;
	retryAfterSeconds?: number;
};

export class ApiError extends Error {
	readonly code?: string;
	readonly retryAfterSeconds?: number;

	constructor(
		message: string,
		public readonly status: number,
		public readonly errors: ValidationErrors = {},
		public readonly cause?: unknown,
		meta: ApiErrorMeta = {}
	) {
		super(message);
		this.name = 'ApiError';
		this.code = meta.code;
		this.retryAfterSeconds = meta.retryAfterSeconds;
	}

	get isUnauthenticated(): boolean {
		return this.status === 401;
	}

	get isForbidden(): boolean {
		return this.status === 403;
	}

	get isValidationError(): boolean {
		return this.status === 422;
	}

	get isCsrfExpired(): boolean {
		return this.status === 419;
	}

	get isRateLimited(): boolean {
		return this.status === 429;
	}

	get isGithubRateLimited(): boolean {
		return this.code === GITHUB_RATE_LIMITED;
	}

	get isServerError(): boolean {
		return this.status >= 500;
	}
}

export class NetworkError extends Error {
	constructor(message = 'Sakala API tidak dapat dijangkau.', cause?: unknown) {
		super(message, { cause });
		this.name = 'NetworkError';
	}
}

export type ApiErrorInput = {
	errors?: ValidationErrors;
	apiMessage?: unknown;
	code?: unknown;
	retryAfterSeconds?: number;
};

export function apiErrorFromResponse(status: number, input: ApiErrorInput = {}): ApiError {
	const { errors = {}, apiMessage, retryAfterSeconds } = input;
	const code = typeof input.code === 'string' && input.code ? input.code : undefined;

	return new ApiError(
		resolveMessage(status, errors, apiMessage, code, retryAfterSeconds),
		status,
		errors,
		apiMessage,
		{
			code,
			retryAfterSeconds
		}
	);
}

function resolveMessage(
	status: number,
	errors: ValidationErrors,
	apiMessage: unknown,
	code: string | undefined,
	retryAfterSeconds: number | undefined
): string {
	if (status === 429) return rateLimitMessage(retryAfterSeconds);
	if (code === GITHUB_RATE_LIMITED) return githubRateLimitMessage(apiMessage, retryAfterSeconds);
	if (code === EMAIL_DELIVERY_UNAVAILABLE) {
		return (
			presentableApiMessage(apiMessage) ??
			'Sakala belum bisa mengirim email untuk saat ini. Masuk lewat GitHub dulu, atau hubungi admin Sakala.'
		);
	}
	if (status === 401 || status === 419 || status >= 500) return defaultMessage(status);

	// Laravel appends "(and 1 more error)" to the 422 message, so the field text reads better.
	const firstFieldError = Object.values(errors).flat()[0];
	if (status === 422 && !code && firstFieldError) return firstFieldError;

	if (code || BUSINESS_STATUSES.has(status)) {
		return presentableApiMessage(apiMessage) ?? defaultMessage(status);
	}

	return defaultMessage(status);
}

function defaultMessage(status: number): string {
	return (
		SAFE_MESSAGES[status] ??
		(status >= 500
			? 'Terjadi kesalahan pada server. Silakan coba lagi nanti.'
			: 'Terjadi kesalahan. Silakan coba lagi.')
	);
}

function presentableApiMessage(value: unknown): string | null {
	if (typeof value !== 'string') return null;

	const message = value.trim();
	if (!message || message.length > MAX_API_MESSAGE_LENGTH) return null;
	if (FRAMEWORK_MESSAGES.has(message.toLowerCase())) return null;
	// A class name or SQL error means an internal exception leaked into the payload.
	if (message.includes('\\') || /SQLSTATE/i.test(message)) return null;

	return message;
}

function rateLimitMessage(retryAfterSeconds: number | undefined): string {
	if (retryAfterSeconds === undefined) {
		return 'Terlalu banyak permintaan dalam waktu singkat. Tunggu sebentar, lalu coba lagi.';
	}

	return `Terlalu banyak permintaan dalam waktu singkat. Coba lagi dalam ${formatWait(retryAfterSeconds)}.`;
}

function githubRateLimitMessage(
	apiMessage: unknown,
	retryAfterSeconds: number | undefined
): string {
	const message =
		presentableApiMessage(apiMessage) ??
		'GitHub sedang membatasi permintaan dari Sakala. Ini bukan masalah di repository kamu.';
	return retryAfterSeconds === undefined
		? message
		: `${message} Bisa dicoba lagi dalam ${formatWait(retryAfterSeconds)}.`;
}

function formatWait(seconds: number): string {
	return seconds < 60 ? `${Math.max(seconds, 1)} detik` : `${Math.ceil(seconds / 60)} menit`;
}

/** Reads `Retry-After`, which is either delta-seconds or an HTTP date (RFC 9110). */
export function parseRetryAfter(
	value: string | null,
	now: number = Date.now()
): number | undefined {
	const raw = value?.trim();
	if (!raw) return undefined;
	if (/^\d+$/.test(raw)) return Number(raw);

	const date = Date.parse(raw);
	if (Number.isNaN(date)) return undefined;

	return Math.max(Math.ceil((date - now) / 1000), 0);
}

/**
 * Text that is safe to show for any thrown value. Only our own error classes qualify: a ZodError
 * or TypeError message is meant for developers.
 */
export function getErrorMessage(error: unknown, fallback: string): string {
	if (error instanceof ApiError || error instanceof NetworkError) return error.message;
	return fallback;
}

/** First validation message for one form field, so it can be shown on that field. */
export function getFieldError(error: unknown, field: string): string | undefined {
	return error instanceof ApiError ? error.errors[field]?.[0] : undefined;
}

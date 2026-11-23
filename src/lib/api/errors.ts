const SAFE_MESSAGES: Record<number, string> = {
	401: 'Sesimu tidak ditemukan. Silakan masuk kembali.',
	403: 'Kamu tidak memiliki akses untuk melakukan tindakan ini.',
	419: 'Sesimu kedaluwarsa. Silakan muat ulang halaman dan coba lagi.',
	422: 'Sakala menolak data yang dikirim. Periksa isian di halaman ini, lalu kirim lagi.'
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
export const EMAIL_DELIVERY_UNAVAILABLE = 'EMAIL_DELIVERY_UNAVAILABLE';

/** Terms changed or were never accepted. Creating and deploying wait until they are. */
export const LEGAL_ACCEPTANCE_REQUIRED = 'LEGAL_ACCEPTANCE_REQUIRED';
/** An account without a password proves itself by logging in at its provider again. */
export const REAUTHENTICATION_REQUIRED = 'REAUTHENTICATION_REQUIRED';

/** A 409 on deploy, inspection, or wake: an admin suspended the project. */
export const PROJECT_SUSPENDED = 'PROJECT_SUSPENDED';
/**
 * A 409 on wake: every replica of the sleeping deployment would take the workspace past its limit
 * of running containers. Carries `limit`, `current`, and, from an API with replicas, `requested`.
 */
export const PROJECT_WAKE_LIMIT_EXCEEDED = 'PROJECT_WAKE_LIMIT_EXCEEDED';
/** A 409 on wake: the project woke or changed in the meantime. Carries `runtime_status`. */
export const PROJECT_NOT_SLEEPING = 'PROJECT_NOT_SLEEPING';
/**
 * A 422 on deploy: the deployment would run more containers than the workspace may. `current`
 * counts every running replica in the workspace, this project's included; `requested` is the
 * replicas the deployment runs.
 */
export const ACTIVE_CONTAINER_LIMIT_EXCEEDED = 'ACTIVE_CONTAINER_LIMIT_EXCEEDED';
/**
 * A 409 on deploy: the project asks for more replicas than any node that could run it allows, or
 * no such node runs replicas yet. Carries `replicas` and `node_maximum` (`null`: none runs them).
 */
export const PROJECT_REPLICAS_UNSUPPORTED = 'PROJECT_REPLICAS_UNSUPPORTED';
/**
 * A 409 on deploy: the project has a release command, and the node that would run the deployment
 * is too old to run one.
 */
export const PROJECT_RELEASE_COMMAND_UNSUPPORTED = 'PROJECT_RELEASE_COMMAND_UNSUPPORTED';

/**
 * A 409 on rollback: the deployment cannot be rolled back to (any more). Carries `reason`:
 * `not_succeeded`, `already_active`, `no_commit`, `branch_changed`, or `settings_unavailable`.
 */
export const DEPLOYMENT_NOT_ROLLBACK_TARGET = 'DEPLOYMENT_NOT_ROLLBACK_TARGET';
/** A 409 on restart: nothing runs to restart. Carries `runtime_status`. */
export const PROJECT_NOT_RUNNING = 'PROJECT_NOT_RUNNING';
/** A 409 on restart: a deployment, or a restart, stop, sleep, or wake, of the project is still open. */
export const PROJECT_RUNTIME_BUSY = 'PROJECT_RUNTIME_BUSY';

/**
 * Refusals of the managed database endpoints (DatabaseRuleException in sakala-api). Their extra
 * fields are read through `parseDatabaseRefusal()` in `api/resources/database-refusals.ts`.
 */
export const DATABASE_ERROR_CODES = {
	limitExceeded: 'DATABASE_LIMIT_EXCEEDED',
	storageLimitExceeded: 'DATABASE_STORAGE_LIMIT_EXCEEDED',
	regionUnavailable: 'DATABASE_REGION_UNAVAILABLE',
	crossRegionUnsupported: 'DATABASE_CROSS_REGION_UNSUPPORTED',
	notReady: 'DATABASE_NOT_READY',
	locked: 'DATABASE_LOCKED',
	inUse: 'DATABASE_IN_USE',
	busy: 'DATABASE_BUSY',
	projectAlreadyAttached: 'PROJECT_DATABASE_ALREADY_ATTACHED',
	endpointUnavailable: 'DATABASE_ENDPOINT_UNAVAILABLE',
	/** No database server takes new databases now; only refused for a database made for a project. */
	unavailable: 'DATABASE_UNAVAILABLE'
} as const;

/**
 * Refusals of the managed bucket endpoints (BucketRuleException in sakala-api, ADR-021). Their
 * extra fields are read through `parseBucketRefusal()` in `api/resources/bucket-refusals.ts`.
 */
export const BUCKET_ERROR_CODES = {
	limitExceeded: 'BUCKET_LIMIT_EXCEEDED',
	storageLimitExceeded: 'BUCKET_STORAGE_LIMIT_EXCEEDED',
	regionUnavailable: 'BUCKET_REGION_UNAVAILABLE',
	capacityUnavailable: 'BUCKET_CAPACITY_UNAVAILABLE',
	notReady: 'BUCKET_NOT_READY',
	locked: 'BUCKET_LOCKED',
	inUse: 'BUCKET_IN_USE',
	busy: 'BUCKET_BUSY',
	projectAlreadyAttached: 'PROJECT_BUCKET_ALREADY_ATTACHED',
	/** No storage server takes new buckets now; only refused for a bucket made for a project. */
	unavailable: 'BUCKET_UNAVAILABLE',
	endpointUnavailable: 'BUCKET_ENDPOINT_UNAVAILABLE',
	/**
	 * The key is being rotated and the node has not confirmed which secret works, or the rotation
	 * ended `unknown`. Refuses credentials and deploys of attached projects until it settles.
	 */
	keyRotating: 'BUCKET_KEY_ROTATING'
} as const;

export type ValidationErrors = Record<string, string[]>;

export type ApiErrorMeta = {
	code?: string;
	retryAfterSeconds?: number;
	details?: Record<string, unknown>;
};

export class ApiError extends Error {
	readonly code?: string;
	readonly retryAfterSeconds?: number;
	/**
	 * The other fields of the error body, such as `limit` and `current`. Unvalidated: read them
	 * through a schema next to the resource that documents them.
	 */
	readonly details: Record<string, unknown>;

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
		this.details = meta.details ?? {};
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

/**
 * What browsers throw when a code-split chunk of the Console cannot be fetched: Chromium, Firefox,
 * and Safari in that order, then Vite's preload helper for the chunk's CSS.
 */
const MODULE_LOAD_FAILURES = [
	'failed to fetch dynamically imported module',
	'error loading dynamically imported module',
	'importing a module script failed',
	'unable to preload css'
];

/** What the same browsers throw from `fetch` when the request never reached a server. */
const FETCH_FAILURES = ['failed to fetch', 'networkerror when attempting to fetch', 'load failed'];

/**
 * The browser could not reach Sakala at all: an API request or a chunk of the Console that never
 * arrived (offline, `ERR_NETWORK_CHANGED`). It says nothing about the server, so it is not shown
 * as a server error.
 */
export function isConnectionFailure(error: unknown): boolean {
	if (error instanceof NetworkError) return true;
	if (!(error instanceof Error)) return false;
	const message = error.message.toLowerCase();
	if (MODULE_LOAD_FAILURES.some((failure) => message.startsWith(failure))) return true;
	return (
		error instanceof TypeError && FETCH_FAILURES.some((failure) => message.startsWith(failure))
	);
}

export type ApiErrorInput = {
	errors?: ValidationErrors;
	apiMessage?: unknown;
	code?: unknown;
	retryAfterSeconds?: number;
	details?: Record<string, unknown>;
};

export function apiErrorFromResponse(status: number, input: ApiErrorInput = {}): ApiError {
	const { errors = {}, apiMessage, retryAfterSeconds, details } = input;
	const code = typeof input.code === 'string' && input.code ? input.code : undefined;

	return new ApiError(
		resolveMessage(status, errors, apiMessage, code, retryAfterSeconds),
		status,
		errors,
		apiMessage,
		{
			code,
			retryAfterSeconds,
			details
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
			? 'Server Sakala sedang bermasalah, jadi permintaan ini belum diproses. Tunggu beberapa menit, lalu ulangi.'
			: 'Sakala belum bisa memproses permintaan ini. Muat ulang halaman, lalu ulangi langkahnya.')
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

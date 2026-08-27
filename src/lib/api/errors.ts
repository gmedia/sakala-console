const SAFE_MESSAGES: Record<number, string> = {
	401: 'Sesi anda tidak ditemukan. silakan coba kembali.',
	403: 'Anda tidak memiliki akses ke halaman ini.',
	419: 'Sesi anda kealuwarsa. Silakan muat ulang halaman dan coba lagi.',
	422: 'Data yang dikirim tidak valid'
};

export type ValidationErrors = Record<string, string[]>;

export class ApiError extends Error {
	constructor(
		message: string,
		public readonly status: number,
		public readonly errors: ValidationErrors = {},
		public readonly cause?: unknown
	) {
		super(message);
		this.name = 'ApiError';
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

export function apiErrorFromResponse(
	status: number,
	errors: ValidationErrors = {},
	cause?: unknown
): ApiError {
	const message =
		SAFE_MESSAGES[status] ??
		(status >= 500
			? 'Terjadi kesalahan pada server. Silakan coba lagi nanti.'
			: 'Terjadi kesalahan. Silakan coba lagi.');
	return new ApiError(message, status, errors, cause);
}

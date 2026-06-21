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
}

export class NetworkError extends Error {
	constructor(message = 'Sakala API tidak dapat dijangkau.', cause?: unknown) {
		super(message, { cause });
		this.name = 'NetworkError';
	}
}

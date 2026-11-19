/**
 * Random secrets the browser makes for a new project, from the Web Crypto API
 * (`crypto.getRandomValues`), which is a cryptographically secure generator in every supported
 * browser. The value never leaves the page except in the request that stores it as a secret.
 *
 * Each format is the one the framework's own generator writes, so the app accepts it as is.
 */

/** The size Laravel's default cipher, AES-256-CBC, expects (`php artisan key:generate`). */
export const LARAVEL_KEY_BYTES = 32;
/** What `rails secret` / `mix phx.gen.secret` print: 64 bytes as 128 hex characters. */
export const SECRET_KEY_BASE_BYTES = 64;
/** 256 bits, the size `openssl rand -base64 32` gives and Auth.js and better-auth document. */
export const GENERIC_SECRET_BYTES = 32;

export const SECRET_FORMATS = {
	/** `base64:` and 32 bytes in standard base64, what Laravel reads as APP_KEY. */
	laravelAppKey: 'laravel-app-key',
	/** 64 bytes as lowercase hex, for Rails and Phoenix SECRET_KEY_BASE. */
	hex64: 'hex-64',
	/** 32 bytes as unpadded base64url, safe in a URL, a header, and a shell. */
	base64url32: 'base64url-32'
} as const;

export type SecretFormat = (typeof SECRET_FORMATS)[keyof typeof SECRET_FORMATS];

function randomBytes(length: number): Uint8Array {
	return crypto.getRandomValues(new Uint8Array(length));
}

function toBase64(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes));
}

function toBase64Url(bytes: Uint8Array): string {
	return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function toHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function generateSecret(format: SecretFormat): string {
	switch (format) {
		case SECRET_FORMATS.laravelAppKey:
			return `base64:${toBase64(randomBytes(LARAVEL_KEY_BYTES))}`;
		case SECRET_FORMATS.hex64:
			return toHex(randomBytes(SECRET_KEY_BASE_BYTES));
		case SECRET_FORMATS.base64url32:
			return toBase64Url(randomBytes(GENERIC_SECRET_BYTES));
	}
}

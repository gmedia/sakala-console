// Mirrors EnvironmentVariableRequest in sakala-api, which stays the final check.
export const ENV_KEY_REGEX = /^[A-Z_][A-Z0-9_]*$/;
export const ENV_KEY_MAX_LENGTH = 128;

export function normalizeEnvKey(raw: string): string {
	return raw.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
}

export function validateEnvKeyFormat(key: string): string | null {
	if (!key) return 'Isi nama variabel, misalnya DATABASE_URL.';
	if (key.length > ENV_KEY_MAX_LENGTH) {
		return `Nama variabel paling panjang ${ENV_KEY_MAX_LENGTH} karakter.`;
	}
	if (!ENV_KEY_REGEX.test(key)) {
		return 'Nama variabel harus diawali huruf atau underscore, misalnya APP_ENV.';
	}
	return null;
}

export function validateEnvValue(value: string): string | null {
	return value.trim() ? null : 'Isi nilai variabel. Aplikasi membacanya saat deploy.';
}

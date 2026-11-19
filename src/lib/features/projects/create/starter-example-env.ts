import type { StarterExampleEnvValue } from '$lib/config/starter-examples';

/** The size Laravel's default cipher, AES-256-CBC, expects. */
const LARAVEL_KEY_BYTES = 32;

function laravelAppKey(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(LARAVEL_KEY_BYTES));
	return `base64:${btoa(String.fromCharCode(...bytes))}`;
}

export function resolveStarterEnvValue(value: StarterExampleEnvValue): string {
	return value.kind === 'fixed' ? value.value : laravelAppKey();
}

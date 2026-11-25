/**
 * What every attached project receives on its next deployment (ValkeyConnectionEnvironment in
 * sakala-api), in the order the API documents them. Kept free of imports, so code that only needs
 * the names does not pull in the HTTP client. `REDIS_URL` carries no database number on purpose:
 * Laravel applies a number in the URL to both its default and cache connections, so
 * `php artisan cache:clear` would also delete queued jobs.
 */
export const VALKEY_VARIABLES = [
	'REDIS_URL',
	'REDIS_HOST',
	'REDIS_PORT',
	'REDIS_PASSWORD'
] as const;

/** The one variable whose value is secret on its own; `REDIS_URL` also holds it. */
export const VALKEY_PASSWORD_VARIABLE = 'REDIS_PASSWORD';

/**
 * Project variables the Console suggests to Laravel apps, never injected by the API: they change
 * how the app behaves beyond the connection (`QUEUE_CONNECTION`, `CACHE_STORE`).
 */
export const LARAVEL_VALKEY_SUGGESTIONS = [
	{ key: 'QUEUE_CONNECTION', value: 'redis' },
	{ key: 'CACHE_STORE', value: 'redis' }
] as const;

export type ValkeySuggestion = (typeof LARAVEL_VALKEY_SUGGESTIONS)[number];

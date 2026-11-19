import { DATABASE_VARIABLES } from '$lib/features/databases/variables';
import { RESERVED_PORT_KEY } from '../env-import/parse-env-text';
import { SECRET_FORMATS, type SecretFormat } from '../secret-generation';

/*
 * The names the `.env.example` classifier treats specially, in one place so the rules read as a
 * list. The classifier itself (classify-env-example.ts) documents the order they apply in.
 */

/** sakala-agent sets PORT from the project's port; a different PORT fails the deployment. */
export const PORT_KEY = RESERVED_PORT_KEY;

/**
 * What an attached database gives every deployment (DatabaseConnectionEnvironment in sakala-api).
 * Sakala fills them only when the project gets a database; without one they are ordinary rows.
 */
export const DATABASE_PROVIDED_KEYS: readonly string[] = DATABASE_VARIABLES;

/**
 * Laravel 11+ reads `DB_URL` before `DB_HOST` and the rest, so an example value here would win
 * over the connection Sakala provides. With a database it is offered, but off by default.
 */
export const DATABASE_URL_OVERRIDE_KEY = 'DB_URL';

/**
 * Variables that name the app's own public address. sakala-api does not inject them (lead's
 * decision for this change: the deploy payload is being changed elsewhere, and APP_URL is
 * Laravel-specific), so they are prefilled with the project's `public_url` as normal variables.
 */
export const PROJECT_URL_KEYS: readonly string[] = ['APP_URL', 'NEXTAUTH_URL', 'AUTH_URL'];

/**
 * Secrets the browser can make on its own, because the app only needs them to be random and
 * stable: session, cookie, and token signing keys. Stored as secrets, never shown unless asked.
 * Anything else that looks like a credential (an API key from a provider, a mail password) must
 * come from the user.
 */
export const GENERATED_SECRET_FORMATS: Readonly<Record<string, SecretFormat>> = {
	APP_KEY: SECRET_FORMATS.laravelAppKey,
	SECRET_KEY_BASE: SECRET_FORMATS.hex64,
	SECRET_KEY: SECRET_FORMATS.base64url32,
	NEXTAUTH_SECRET: SECRET_FORMATS.base64url32,
	AUTH_SECRET: SECRET_FORMATS.base64url32,
	BETTER_AUTH_SECRET: SECRET_FORMATS.base64url32,
	JWT_SECRET: SECRET_FORMATS.base64url32,
	SESSION_SECRET: SECRET_FORMATS.base64url32,
	COOKIE_SECRET: SECRET_FORMATS.base64url32,
	APP_SECRET: SECRET_FORMATS.base64url32
};

/**
 * Values a `.env.example` sets for a laptop that a deployed app should not keep. Suggested,
 * visibly, and still editable.
 */
export const PRODUCTION_OVERRIDES: Readonly<Record<string, string>> = {
	APP_ENV: 'production',
	NODE_ENV: 'production',
	APP_DEBUG: 'false'
};

/**
 * A `.env.example` often logs everything on a laptop (Laravel's writes `LOG_LEVEL=debug`), which
 * in production fills the log with request detail. `info` is normal operation for Monolog, pino,
 * winston, and Python's logging. Only these verbose levels are replaced, and in the example's case
 * (Python's logging knows `INFO`, not `info`), so a stricter level the project chose stays.
 */
export const LOG_LEVEL_KEY = 'LOG_LEVEL';
export const VERBOSE_LOG_LEVELS: readonly string[] = ['debug', 'trace'];
export const PRODUCTION_LOG_LEVEL = 'info';

/** What Laravel's `.env.example` writes for "no value"; read as empty, like an empty line. */
export const EMPTY_EXAMPLE_VALUES: readonly string[] = ['null', '""', "''"];

/**
 * `${APP_NAME}`: dotenv-expand would read another variable here. Sakala stores the text as it is,
 * so the literal would reach the app; the row is left for the user instead.
 */
export const VARIABLE_REFERENCE = /\$\{[A-Za-z_][A-Za-z0-9_]*\}/;

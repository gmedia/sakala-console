/**
 * Public settings the container supplies when it starts, so one published image can serve any
 * installation. `docker/entrypoint.sh` renders `/runtime-config.js` from the container's
 * environment, and `src/app.html` loads it before the app starts. It sets one global object whose
 * keys are the same `PUBLIC_*` names the build reads.
 *
 * Every key is optional. A key that is missing or invalid falls back to the value baked in at
 * build time, so an image whose container sets nothing behaves exactly as it was built.
 */

export const RUNTIME_CONFIG_GLOBAL = '__SAKALA_RUNTIME_CONFIG__';

export const PUBLIC_CONFIG_KEYS = [
	'PUBLIC_API_URL',
	'PUBLIC_APP_URL',
	'PUBLIC_REVERB_HOST',
	'PUBLIC_REVERB_PORT',
	'PUBLIC_REVERB_SCHEME',
	'PUBLIC_REVERB_KEY'
] as const;

export type PublicConfigKey = (typeof PUBLIC_CONFIG_KEYS)[number];
export type PublicConfigValues = Partial<Record<PublicConfigKey, string>>;

const HOST_PATTERN = /^[a-z0-9.-]+$/i;
const KEY_PATTERN = /^[a-z0-9._-]*$/i;

export function isHttpUrl(value: string): boolean {
	if (!URL.canParse(value)) return false;
	const { protocol } = new URL(value);
	return protocol === 'http:' || protocol === 'https:';
}

function isPort(value: string): boolean {
	if (!/^\d{1,5}$/.test(value)) return false;
	const port = Number(value);
	return port >= 1 && port <= 65_535;
}

/**
 * The same rules `docker/entrypoint.sh` applies before it writes the file. Checking again here
 * keeps a hand-edited or stale file from pointing the browser at something that is not a web
 * origin. An empty `PUBLIC_REVERB_KEY` is valid: it switches realtime off.
 */
const validators: Record<PublicConfigKey, (value: string) => boolean> = {
	PUBLIC_API_URL: isHttpUrl,
	PUBLIC_APP_URL: isHttpUrl,
	PUBLIC_REVERB_HOST: (value) => HOST_PATTERN.test(value),
	PUBLIC_REVERB_PORT: isPort,
	PUBLIC_REVERB_SCHEME: (value) => value === 'http' || value === 'https',
	PUBLIC_REVERB_KEY: (value) => KEY_PATTERN.test(value)
};

/**
 * Reads the runtime settings from `source` (the window, by default) and keeps only known keys with
 * valid string values. Anything else is dropped with a console warning rather than thrown, because
 * the build-time value is still a working fallback.
 */
export function readRuntimeConfig(source: object = globalThis): PublicConfigValues {
	const raw: unknown = Reflect.get(source, RUNTIME_CONFIG_GLOBAL);
	if (raw === undefined || raw === null) return {};
	if (typeof raw !== 'object' || Array.isArray(raw)) {
		console.warn(`Ignoring ${RUNTIME_CONFIG_GLOBAL}: expected an object.`);
		return {};
	}

	const values: PublicConfigValues = {};
	for (const key of PUBLIC_CONFIG_KEYS) {
		if (!Object.hasOwn(raw, key)) continue;
		const value: unknown = Reflect.get(raw, key);
		if (typeof value === 'string' && validators[key](value)) {
			values[key] = value;
		} else {
			console.warn(`Ignoring runtime ${key}: the value is not valid, using the build-time value.`);
		}
	}
	return values;
}

/** Runtime values win key by key; every key the runtime does not set keeps its build-time value. */
export function withRuntimeConfig<T extends Partial<Record<string, string | undefined>>>(
	buildTime: T,
	runtime: PublicConfigValues = readRuntimeConfig()
): T & PublicConfigValues {
	return { ...buildTime, ...runtime };
}

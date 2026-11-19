/**
 * Every pasted variable is stored as a secret unless the user turns that off. When they do, the
 * ones that look like credentials stay secret, and the panel names them. This only picks a safer
 * default the user can see; it never makes a value readable on its own.
 *
 * Hand-written on purpose: scanners such as secretlint or detect-secrets are Node CLIs built to
 * scan repositories, far heavier than a default for a checkbox. These rules follow the key names
 * frameworks use and the prefixes the providers publish for their tokens.
 */

const SECRET_KEY_PARTS =
	/(SECRET|PASSWORD|PASSWD|PASSPHRASE|TOKEN|PRIVATE|CREDENTIAL|API_?KEY|ACCESS_?KEY|AUTH|SALT|SIGNING|DSN|COOKIE|SESSION_KEY|ENCRYPTION|WEBHOOK)/;
/** `APP_KEY`, `STRIPE_KEY` and the like; `KEY` as a whole word, not inside `MONKEY`. */
const KEY_WORD = /(^|_)KEY($|_)/;

const SECRET_VALUE_PATTERNS: RegExp[] = [
	/^-----BEGIN [A-Z ]*PRIVATE KEY-----/,
	/^[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:[^/\s@]+@/i, // a URL with a password, such as DATABASE_URL
	/^gh[pousr]_[A-Za-z0-9]{20,}$/, // GitHub tokens
	/^github_pat_[A-Za-z0-9_]{20,}$/,
	/^(sk|rk|pk)_(live|test)_[A-Za-z0-9]{10,}$/, // Stripe
	/^xox[abposr]-[A-Za-z0-9-]{10,}$/, // Slack
	/^AKIA[0-9A-Z]{16}$/, // AWS access key id
	/^AIza[0-9A-Za-z_-]{30,}$/, // Google API key
	/^eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, // a JWT
	/^base64:[A-Za-z0-9+/=]{32,}$/ // Laravel APP_KEY
];

/** A name frameworks give to credentials: `DB_PASSWORD`, `JWT_SECRET`, `APP_KEY`. */
export function keyLooksLikeSecret(key: string): boolean {
	return SECRET_KEY_PARTS.test(key) || KEY_WORD.test(key);
}

/** A value shaped like a published token format or a URL that carries a password. */
export function valueLooksLikeSecret(value: string): boolean {
	const trimmed = value.trim();
	return SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function looksLikeSecret(key: string, value: string): boolean {
	return keyLooksLikeSecret(key) || valueLooksLikeSecret(value);
}

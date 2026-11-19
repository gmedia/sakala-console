/**
 * Masks what looks like a credential before a failure summary leaves the browser. It is a safety
 * net, not a guarantee, which is why the summary also asks people to read it before sharing.
 *
 * Hand-written: secret scanners (secretlint, detect-secrets, gitleaks) are repository CLIs and do
 * not run in a browser. These rules cover the shapes a build log really prints: URLs with a
 * password, `NAME=value` with a secret-sounding name, bearer tokens, private keys, and the token
 * prefixes GitHub, Stripe, Slack, AWS, and Google publish.
 */
export const REDACTED = '[disamarkan]';

const RULES: [pattern: RegExp, replace: string][] = [
	// -----BEGIN ... PRIVATE KEY----- to its END line, or to the end of the text when cut off.
	[/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(-----END [A-Z ]*PRIVATE KEY-----|$)/g, REDACTED],
	// scheme://user:password@host keeps the user and the host, which help, and hides the password.
	[/\b([a-z][a-z0-9+.-]*:\/\/[^/\s:@]+):[^/\s@]+@/gi, `$1:${REDACTED}@`],
	// NAME=value or NAME: value, when the name sounds secret.
	[
		/\b([A-Z0-9_]*(?:SECRET|PASSWORD|PASSWD|TOKEN|PRIVATE|CREDENTIAL|API_?KEY|ACCESS_?KEY|AUTH|_KEY|DSN)[A-Z0-9_]*)(\s*[=:]\s*)("[^"]*"|'[^']*'|\S+)/g,
		`$1$2${REDACTED}`
	],
	[/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/g, `$1 ${REDACTED}`],
	[/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, REDACTED],
	[/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, REDACTED],
	[/\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{10,}\b/g, REDACTED],
	[/\bxox[abposr]-[A-Za-z0-9-]{10,}\b/g, REDACTED],
	[/\bAKIA[0-9A-Z]{16}\b/g, REDACTED],
	[/\bAIza[0-9A-Za-z_-]{30,}\b/g, REDACTED],
	[/\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, REDACTED],
	[/\bbase64:[A-Za-z0-9+/=]{32,}/g, REDACTED]
];

export function redactSecrets(text: string): string {
	return RULES.reduce((current, [pattern, replace]) => current.replace(pattern, replace), text);
}

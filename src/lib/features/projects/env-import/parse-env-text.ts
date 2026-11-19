import { parse } from 'dotenv';
import { ENV_KEY_MAX_LENGTH, ENV_KEY_REGEX } from '../validation/environmentVariable';

/**
 * Sakala sets PORT itself from the project's port (sakala-agent exports `PORT=container_port`),
 * and a different PORT makes the deployment fail with `runtime_port_conflict`.
 */
export const RESERVED_PORT_KEY = 'PORT';

export type ParsedEnvEntry = { key: string; value: string };

export type SkippedEnvEntry = {
	key: string;
	reason: 'invalid_key' | 'empty_value';
};

export type ParsedEnvText = {
	entries: ParsedEnvEntry[];
	skipped: SkippedEnvEntry[];
	/** The PORT value from the text, kept out of `entries`. */
	port: string | null;
	/** Lines that are neither blank, a comment, nor `KEY=value`, so nothing was read from them. */
	unreadableLines: number;
};

const COMMENT_OR_BLANK = /^\s*(#.*)?$/;
const ASSIGNMENT = /^\s*(export\s+)?[\w.-]+\s*[=:]/;

/**
 * Reads the text of a `.env` file with dotenv's own parser, so quotes, comments, `export` and
 * multi-line values behave the way the user's local tooling reads them. A key that appears twice
 * keeps its last value, also like dotenv.
 */
export function parseEnvText(text: string): ParsedEnvText {
	const parsed = parse(text);
	const entries: ParsedEnvEntry[] = [];
	const skipped: SkippedEnvEntry[] = [];
	let port: string | null = null;

	for (const [key, value] of Object.entries(parsed)) {
		if (key === RESERVED_PORT_KEY) {
			port = value.trim() || null;
		} else if (!ENV_KEY_REGEX.test(key) || key.length > ENV_KEY_MAX_LENGTH) {
			skipped.push({ key, reason: 'invalid_key' });
		} else if (!value.trim()) {
			skipped.push({ key, reason: 'empty_value' });
		} else {
			entries.push({ key, value });
		}
	}

	// Only top-level lines count: a quoted multi-line value spans lines that are not assignments.
	const unreadableLines = countUnreadableLines(text);

	return { entries, skipped, port, unreadableLines };
}

function countUnreadableLines(text: string): number {
	let count = 0;
	let openQuote: string | null = null;
	for (const line of text.split(/\r\n?|\n/)) {
		if (openQuote) {
			if (line.includes(openQuote)) openQuote = null;
			continue;
		}
		if (COMMENT_OR_BLANK.test(line)) continue;
		if (!ASSIGNMENT.test(line)) {
			count += 1;
			continue;
		}
		const value = line.slice(line.search(/[=:]/) + 1).trimStart();
		const quote = value[0];
		if ((quote === '"' || quote === "'" || quote === '`') && value.indexOf(quote, 1) === -1) {
			openQuote = quote;
		}
	}
	return count;
}

/** Text with a line break and at least one `KEY=value` line: a pasted file, not a single name. */
export function looksLikeEnvFile(text: string): boolean {
	return /\r|\n/.test(text.trim()) && text.split(/\r\n?|\n/).some((line) => ASSIGNMENT.test(line));
}

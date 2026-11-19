import type { DeploymentLogLine } from './deployment-logs';
import type { LogLevel } from './log-classification';

const PERMALINK = /^#L(\d+)$/;

/** `#L120` points at line 120 of the log, by its own sequence, the number shown in the gutter. */
export function parseLinePermalink(hash: string): number | null {
	const match = hash.match(PERMALINK);
	if (!match) return null;
	const sequence = Number(match[1]);
	return Number.isSafeInteger(sequence) && sequence > 0 ? sequence : null;
}

export function linePermalinkHash(sequence: number): string {
	return `#L${sequence}`;
}

/**
 * Search and "Hanya error" over the loaded lines. Search ignores case, and "Hanya error" uses the
 * same levels as the colours, so what it keeps is exactly what is shown red.
 */
export function filterLogLines(
	lines: readonly DeploymentLogLine[],
	{
		query,
		errorsOnly,
		levelOf
	}: {
		query: string;
		errorsOnly: boolean;
		levelOf: (line: DeploymentLogLine) => LogLevel | undefined;
	}
): DeploymentLogLine[] {
	const needle = query.trim().toLocaleLowerCase('id');
	if (!needle && !errorsOnly) return [...lines];
	return lines.filter(
		(line) =>
			(!errorsOnly || levelOf(line) === 'error') &&
			(!needle || line.message.toLocaleLowerCase('id').includes(needle))
	);
}

/** `toko-kopi-web-deployment-5.txt`, safe as a file name on any system. */
export function logDownloadFileName(projectName: string, sequence: number): string {
	const slug =
		projectName
			.normalize('NFKD')
			.replace(/[̀-ͯ]/g, '')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '') || 'proyek';
	return `${slug}-deployment-${sequence}.txt`;
}

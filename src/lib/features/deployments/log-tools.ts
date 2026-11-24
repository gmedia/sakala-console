import type { DeploymentLogLine } from './deployment-logs';
import type { LogLevel } from './log-classification';
import { JOB_PROCESS, WEB_PROCESS } from '$lib/features/workloads/rules';

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

/** The process filter's value for every process except scheduled runs. */
export const ALL_LOG_PROCESSES = '';

/**
 * The process a line belongs to: the worker's name, `job` for a scheduled run's output, and `web`
 * for the deployment's own lines (build, release command, web), which carry none (ADR-022).
 */
export function logProcessOf(line: Pick<DeploymentLogLine, 'process'>): string {
	return line.process ?? WEB_PROCESS;
}

/** Output of scheduled runs, which the deployment log leaves to the schedule's run history. */
export function isJobOutput(line: Pick<DeploymentLogLine, 'process'>): boolean {
	return line.process === JOB_PROCESS;
}

/**
 * The processes the filter offers, from the loaded lines: `web` first, then the workers by name.
 * Scheduled runs are not one of them. One entry means there is nothing to choose between.
 */
export function logProcessOptions(lines: readonly Pick<DeploymentLogLine, 'process'>[]): string[] {
	const workers = new Set<string>();
	for (const line of lines) {
		if (line.process && !isJobOutput(line)) workers.add(line.process);
	}
	return [WEB_PROCESS, ...[...workers].sort()];
}

/**
 * Search, "Hanya error", and the process filter over the loaded lines. Search ignores case, and
 * "Hanya error" uses the same levels as the colours, so what it keeps is exactly what is shown red.
 * Scheduled runs' output is always left out: the maintainer chose to show it in the run history.
 */
export function filterLogLines(
	lines: readonly DeploymentLogLine[],
	{
		query,
		errorsOnly,
		levelOf,
		process = ALL_LOG_PROCESSES
	}: {
		query: string;
		errorsOnly: boolean;
		levelOf: (line: DeploymentLogLine) => LogLevel | undefined;
		/** A process name from `logProcessOptions`, or every process. */
		process?: string;
	}
): DeploymentLogLine[] {
	const needle = query.trim().toLocaleLowerCase('id');
	return lines.filter(
		(line) =>
			!isJobOutput(line) &&
			(process === ALL_LOG_PROCESSES || logProcessOf(line) === process) &&
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

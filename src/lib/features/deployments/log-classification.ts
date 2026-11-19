import type { Deployment, DeploymentEvent } from '$lib/api/resources/deployment';
import type { DeploymentLogLine } from './deployment-logs';
import { getStageStarts } from './deployment-normalization';
import { getStageFromStatus } from './status-config';

/**
 * How a log line is shown, and what "Hanya error", "Lihat error di log", and "Salin ringkasan
 * error" pick. One classification for all of them.
 *
 * stderr is not an error. git, BuildKit, Railpack, npm, and composer write their normal progress
 * there, so a successful deploy is mostly stderr, and painting it red made people think it failed.
 *
 * The API sends no level per line (only `stream`), so the deployment decides:
 * - A line is an error only in a failed deployment, inside the stage that failed (from
 *   `failure.stage` and the agent's stage events), when it says so in words (see ERROR_MARKER),
 *   plus the last stderr line of that stage, which is where tools print the final reason.
 * - A line is a warning, in any deployment, only when it says "warn" or "warning" as a word.
 * Everything else is normal, whatever its stream. The word lists are a heuristic, scoped by the
 * failure so that "0 errors" or a test named "fails on empty input" in a good build is never red.
 * When the agent sends a level per line, it should replace these words.
 */
export type LogLevel = 'error' | 'warning' | 'normal';

/** Words tools use for the line that explains a failure: npm ERR!, BuildKit ERROR:, Traceback. */
const ERROR_MARKER =
	/(^|[^a-z])(error|err!|fatal|failed|failure|exception|traceback|panic)([^a-z]|$)/i;
const WARNING_MARKER = /(^|[^a-z])(warn|warning)([^a-z]|$)/i;
/**
 * Log times come from the agent's clock and `finished_at` from the API's, in whole seconds, so the
 * failing stage's last lines can carry a time just after it.
 */
const FAILURE_END_GRACE_MS = 30_000;

export type FailureWindow = { start: number; end: number };

/**
 * The stretch of time the failed stage ran, or null when the deployment did not fail. Without a
 * recorded start for that stage, the last recorded stage stands in; without any, the whole run.
 */
export function getFailureWindow(
	deployment: Pick<Deployment, 'status' | 'failure' | 'started_at' | 'created_at' | 'finished_at'>,
	events: readonly DeploymentEvent[]
): FailureWindow | null {
	if (deployment.status !== 'failed') return null;

	const starts = getStageStarts(events);
	const failedStage = getStageFromStatus(deployment.failure?.stage);
	const start =
		starts.find((item) => item.stage === failedStage)?.startedAt ??
		starts.at(-1)?.startedAt ??
		deployment.started_at ??
		deployment.created_at;
	const end = deployment.finished_at
		? Date.parse(deployment.finished_at) + FAILURE_END_GRACE_MS
		: Infinity;

	return { start: start ? Date.parse(start) : -Infinity, end };
}

function inWindow(line: DeploymentLogLine, window: FailureWindow): boolean {
	const time = Date.parse(line.recorded_at);
	return time >= window.start && time <= window.end;
}

/** One level per line, in the order of `lines`. */
export function classifyLogLines(
	lines: readonly DeploymentLogLine[],
	window: FailureWindow | null
): LogLevel[] {
	let finalStderr = -1;
	if (window) {
		for (let index = lines.length - 1; index >= 0; index--) {
			const line = lines[index];
			if (line.stream === 'stderr' && line.message.trim() && inWindow(line, window)) {
				finalStderr = index;
				break;
			}
		}
	}

	return lines.map((line, index) => {
		const failing = window !== null && line.stream !== 'system' && inWindow(line, window);
		if (failing && (index === finalStderr || ERROR_MARKER.test(line.message))) return 'error';
		if (WARNING_MARKER.test(line.message)) return 'warning';
		return 'normal';
	});
}

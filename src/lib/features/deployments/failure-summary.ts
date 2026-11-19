import type { Deployment } from '$lib/api/resources/deployment';
import type { DeploymentLogLine } from './deployment-logs';
import { formatLogTime } from './deployment-presentation';
import { redactSecrets } from './redact-secrets';
import { getDeploymentStageLabel, getRecoveryHintLabel, getStageFromStatus } from './status-config';

/** Enough to see the error and what led to it, short enough to paste into a chat. */
export const FAILURE_SUMMARY_LOG_LINES = 30;

export const FAILURE_SUMMARY_WARNING =
	'Periksa dulu sebelum dibagikan: log bisa memuat nilai rahasia yang tidak dikenali Sakala.';

type SummaryInput = {
	projectName: string;
	deployment: Pick<
		Deployment,
		'sequence' | 'branch' | 'commit_sha' | 'failure' | 'failure_code' | 'failure_summary'
	>;
	/** The failing stage's lines, oldest first: only the last stderr lines are used. */
	stageLines: readonly DeploymentLogLine[];
};

/**
 * The text "Salin ringkasan error" puts on the clipboard: plain Indonesian that reads on its own in
 * a chat with a friend, a lecturer, or an AI assistant. Every line is passed through
 * `redactSecrets`, and the text ends with a reminder to check it.
 */
export function buildFailureSummary({ projectName, deployment, stageLines }: SummaryInput): string {
	const failure = deployment.failure;
	const stage = getStageFromStatus(failure?.stage);
	const code = failure?.code ?? deployment.failure_code;
	const summary = failure?.summary ?? deployment.failure_summary;
	const commit = deployment.commit_sha ? `, commit ${deployment.commit_sha.slice(0, 7)}` : '';
	const lines = stageLines
		.filter((line) => line.stream === 'stderr')
		.slice(-FAILURE_SUMMARY_LOG_LINES);

	const parts = [
		`Deployment #${deployment.sequence} proyek ${projectName} gagal (branch ${deployment.branch}${commit}).`,
		stage ? `Tahap: ${getDeploymentStageLabel(stage)}` : null,
		code ? `Kode: ${code}` : null,
		summary ? `Ringkasan: ${summary}` : null,
		failure?.recovery_hint
			? `${getRecoveryHintLabel(failure.user_fixable)} ${failure.recovery_hint}`
			: null,
		failure?.detail ? `Detail: ${failure.detail}` : null,
		lines.length > 0
			? [
					`Baris stderr terakhir dari tahap itu (${lines.length}):`,
					...lines.map((line) => `[${formatLogTime(line.recorded_at)}] ${line.message}`)
				].join('\n')
			: null,
		FAILURE_SUMMARY_WARNING
	];

	return redactSecrets(parts.filter((part) => part !== null).join('\n\n'));
}

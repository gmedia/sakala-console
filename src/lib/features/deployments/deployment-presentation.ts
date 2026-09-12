import type { DeploymentStep } from './type';

const triggerLabels: Record<string, string> = {
	manual: 'Manual',
	redeploy: 'Manual redeploy',
	webhook: 'Push',
	system: 'System'
};

export function getDeploymentTriggerLabel(trigger: string): string {
	return triggerLabels[trigger] ?? trigger;
}

export function deriveCurrentStepLabel(steps: DeploymentStep[]): string | undefined {
	return steps.find((step) => step.status === 'running')?.title;
}

export function deriveFailedStepLabel(steps: DeploymentStep[]): string | undefined {
	return steps.find((step) => step.status === 'failed')?.title;
}

export function deriveDurationLabel(
	startedAt: string,
	finishedAt: string | null
): string | undefined {
	if (!finishedAt) return undefined;
	const durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
	const durationSeconds = Math.round(durationMs / 1000);
	return `${durationSeconds} detik`;
}

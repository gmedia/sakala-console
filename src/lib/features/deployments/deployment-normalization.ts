import type { Deployment, DeploymentEvent } from '$lib/api/resources/deployment';
import { getDeploymentStageLabel, getStageFromStatus } from './status-config';
import {
	DEPLOYMENT_PIPELINE_STAGES,
	type DeploymentPipelineStage,
	type DeploymentStage,
	type DeploymentStep
} from './type';

/**
 * Agent events that open a stage. `deployment.runtime.ready` is left out on purpose: it says the
 * route is live and cleanup finished, not that routing began.
 */
const EVENT_STAGE_MAP: Record<string, DeploymentPipelineStage> = {
	'deployment.checkout.started': 'Cloning',
	'deployment.analysis.started': 'Analyzing',
	'deployment.build.started': 'Building',
	'deployment.container.started': 'Deploying',
	'deployment.health.started': 'HealthChecking',
	'deployment.route.started': 'Routing'
};

function getStageFromEvent(event: DeploymentEvent): DeploymentPipelineStage | undefined {
	return event.type ? EVENT_STAGE_MAP[event.type] : undefined;
}

/**
 * The timeline only names stages this deployment really went through, or can still go through.
 * Older agents skip the analysis, health, and route events, so a stage that was passed without an
 * event disappears instead of being reported as done.
 */
export function normalizeDeploymentTimeline(
	deployment: Deployment,
	events: DeploymentEvent[]
): DeploymentStep[] {
	const sortedEvents = sortUniqueEvents(events);

	const stageEvents = new Map<DeploymentPipelineStage, DeploymentEvent>();
	for (const event of sortedEvents) {
		const stage = getStageFromEvent(event);
		if (stage) stageEvents.set(stage, event);
	}

	const currentStage = getCurrentStage(deployment, sortedEvents);
	const isActive = isActiveDeployment(deployment.status);
	const currentIndex = currentStage ? DEPLOYMENT_PIPELINE_STAGES.indexOf(currentStage) : -1;

	// Nothing to base a claim on: pruned events, or a failure before any stage was recorded.
	if (currentIndex === -1 && stageEvents.size === 0) return [];

	const visibleStages = DEPLOYMENT_PIPELINE_STAGES.filter((stage, index) => {
		if (stage === 'Queued' || stage === currentStage || stageEvents.has(stage)) return true;
		return isActive && index > currentIndex;
	});

	return visibleStages.map((stage) => {
		const status = getStepStatus(deployment, stage, currentIndex);
		// A stage's event says when it began; the step that stopped shows when it stopped.
		const stoppedAt =
			status === 'failed' || status === 'cancelled'
				? (deployment.finished_at ?? deployment.cancelled_at)
				: null;
		return {
			key: stage,
			title: getDeploymentStageLabel(stage),
			status,
			timestamp: stoppedAt ?? stageEvents.get(stage)?.occurred_at ?? undefined
		};
	});
}

function getCurrentStage(
	deployment: Deployment,
	sortedEvents: DeploymentEvent[]
): DeploymentPipelineStage | undefined {
	if (isActiveDeployment(deployment.status)) {
		return asPipelineStage(getStageFromStatus(deployment.status));
	}

	if (deployment.status !== 'failed' && deployment.status !== 'cancelled') return undefined;

	const failureStage = asPipelineStage(getStageFromStatus(deployment.failure?.stage));
	if (failureStage) return failureStage;

	for (let i = sortedEvents.length - 1; i >= 0; i--) {
		const stage = getStageFromEvent(sortedEvents[i]);
		if (stage) return stage;
	}

	// It never started, so it stopped while waiting in the queue.
	return deployment.started_at ? undefined : 'Queued';
}

function getStepStatus(
	deployment: Deployment,
	stage: DeploymentPipelineStage,
	currentIndex: number
): DeploymentStep['status'] {
	if (deployment.status === 'succeeded') return 'success';

	const stageIndex = DEPLOYMENT_PIPELINE_STAGES.indexOf(stage);

	if (stageIndex === currentIndex) {
		if (deployment.status === 'failed') return 'failed';
		if (deployment.status === 'cancelled') return 'cancelled';
		return 'running';
	}

	return stageIndex < currentIndex ? 'success' : 'pending';
}

function isActiveDeployment(status: string): boolean {
	return asPipelineStage(getStageFromStatus(status)) !== undefined;
}

function asPipelineStage(stage: DeploymentStage | undefined): DeploymentPipelineStage | undefined {
	return (DEPLOYMENT_PIPELINE_STAGES as readonly string[]).includes(stage ?? '')
		? (stage as DeploymentPipelineStage)
		: undefined;
}

export function sortUniqueEvents(events: DeploymentEvent[]): DeploymentEvent[] {
	const uniqueEvents = new Map<number, DeploymentEvent>();
	for (const event of events) {
		if (!uniqueEvents.has(event.sequence)) uniqueEvents.set(event.sequence, event);
	}
	return [...uniqueEvents.values()].sort((a, b) => a.sequence - b.sequence);
}

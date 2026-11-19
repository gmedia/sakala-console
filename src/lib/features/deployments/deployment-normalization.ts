import type { Deployment, DeploymentEvent } from '$lib/api/resources/deployment';
import {
	parseWorkspaceEventMetadata,
	WORKSPACE_DETECTED_EVENT
} from '$lib/features/projects/monorepo-presentation';
import {
	getImageBuildState,
	getReusedStepSegments,
	IMAGE_REUSED_EVENT,
	segmentsToText,
	type ImageSource
} from './image-reuse-presentation';
import { getDeploymentStageLabel, getStageFromStatus } from './status-config';
import {
	DEPLOYMENT_PIPELINE_STAGES,
	IMAGE_REUSED_STAGE,
	REUSED_IMAGE_PIPELINE_STAGES,
	type DeploymentPipelineStage,
	type DeploymentStage,
	type DeploymentStep,
	type TimelineStage
} from './type';

/**
 * Agent events that open a stage. `deployment.runtime.ready` is left out on purpose: it says the
 * route is live and cleanup finished, not that routing began.
 */
/** Never used in practice: the image step is only in the timeline of a reused deployment. */
const UNKNOWN_IMAGE_SOURCE: ImageSource = { deploymentId: null, sequence: null };

const EVENT_STAGE_MAP: Record<string, TimelineStage> = {
	[IMAGE_REUSED_EVENT]: IMAGE_REUSED_STAGE,
	'deployment.checkout.started': 'Cloning',
	'deployment.analysis.started': 'Analyzing',
	'deployment.build.started': 'Building',
	'deployment.container.started': 'Deploying',
	'deployment.health.started': 'HealthChecking',
	'deployment.route.started': 'Routing'
};

function getStageFromEvent(event: DeploymentEvent): TimelineStage | undefined {
	return event.type ? EVENT_STAGE_MAP[event.type] : undefined;
}

/** When each stage began, by the agent's events, in order. A stage seen twice keeps its last start. */
export function getStageStarts(
	events: readonly DeploymentEvent[]
): { stage: TimelineStage; startedAt: string }[] {
	const starts = new Map<TimelineStage, string>();
	for (const event of sortUniqueEvents([...events])) {
		const stage = getStageFromEvent(event);
		if (stage) starts.set(stage, event.occurred_at);
	}
	return [...starts].map(([stage, startedAt]) => ({ stage, startedAt }));
}

/**
 * The timeline only names stages this deployment really went through, or can still go through.
 * Older agents skip the analysis, health, and route events, so a stage that was passed without an
 * event disappears instead of being reported as done. A deployment that reuses an image has one
 * step in place of checkout, analysis, and build, which it never runs.
 */
export function normalizeDeploymentTimeline(
	deployment: Deployment,
	events: DeploymentEvent[]
): DeploymentStep[] {
	const sortedEvents = sortUniqueEvents(events);
	const buildState = getImageBuildState(deployment.build, sortedEvents);
	const imageSource = buildState.kind === 'reused' ? buildState.source : null;
	const pipeline: readonly TimelineStage[] = imageSource
		? REUSED_IMAGE_PIPELINE_STAGES
		: DEPLOYMENT_PIPELINE_STAGES;

	const stageEvents = new Map<TimelineStage, DeploymentEvent>();
	for (const event of sortedEvents) {
		const stage = getStageFromEvent(event);
		if (stage && pipeline.includes(stage)) stageEvents.set(stage, event);
	}

	const currentStage = getCurrentStage(deployment, sortedEvents, pipeline);
	const isActive = isActiveDeployment(deployment.status);
	const currentIndex = currentStage ? pipeline.indexOf(currentStage) : -1;

	// Nothing to base a claim on: pruned events, or a failure before any stage was recorded.
	if (currentIndex === -1 && stageEvents.size === 0) return [];

	const visibleStages = pipeline.filter((stage, index) => {
		if (stage === 'Queued' || stage === currentStage || stageEvents.has(stage)) return true;
		return isActive && index > currentIndex;
	});

	const stageStart = (stage: TimelineStage) =>
		stage === 'Queued' ? deployment.created_at : stageEvents.get(stage)?.occurred_at;

	// The agent reports the workspace while analysing; without that step, the build step shows it.
	const workspaceEvent = sortedEvents.findLast((event) => event.type === WORKSPACE_DETECTED_EVENT);
	const monorepo = workspaceEvent ? parseWorkspaceEventMetadata(workspaceEvent.metadata) : null;
	const monorepoStage: DeploymentPipelineStage = visibleStages.includes('Analyzing')
		? 'Analyzing'
		: 'Building';

	return visibleStages.map((stage, index) => {
		const status = getStepStatus(deployment, pipeline.indexOf(stage), currentIndex);
		// A stage's event says when it began; the step that stopped shows when it stopped.
		const stoppedAt =
			status === 'failed' || status === 'cancelled'
				? (deployment.finished_at ?? deployment.cancelled_at)
				: null;
		return {
			key: stage,
			title:
				stage === IMAGE_REUSED_STAGE
					? segmentsToText(getReusedStepSegments(imageSource ?? UNKNOWN_IMAGE_SOURCE))
					: getDeploymentStageLabel(stage),
			status,
			timestamp: stoppedAt ?? stageEvents.get(stage)?.occurred_at ?? undefined,
			durationSeconds: stageDuration(
				status,
				stageStart(stage),
				// The next stage began when this one ended, and the last one ends with the deployment.
				visibleStages
					.slice(index + 1)
					.map(stageStart)
					.find(Boolean) ??
					(stage === 'Queued' ? deployment.started_at : null) ??
					deployment.finished_at ??
					deployment.cancelled_at
			),
			...(monorepo && stage === monorepoStage && { monorepo }),
			...(stage === IMAGE_REUSED_STAGE && imageSource && { imageSource })
		};
	});
}

function stageDuration(
	status: DeploymentStep['status'],
	start: string | null | undefined,
	end: string | null | undefined
): number | undefined {
	if (status === 'pending' || status === 'running' || !start || !end) return undefined;
	const seconds = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1_000);
	return seconds >= 0 ? seconds : undefined;
}

function getCurrentStage(
	deployment: Deployment,
	sortedEvents: DeploymentEvent[],
	pipeline: readonly TimelineStage[]
): TimelineStage | undefined {
	const recorded = getStageFromStatus(
		isActiveDeployment(deployment.status) ? deployment.status : deployment.failure?.stage
	);
	const recordedStage = pipeline.find((stage) => stage === recorded);
	const lastEventStage = sortedEvents
		.map(getStageFromEvent)
		.findLast((stage) => stage !== undefined && pipeline.includes(stage));

	// The reused image has no status of its own, so its event is the only sign the step began.
	if (pipeline === REUSED_IMAGE_PIPELINE_STAGES && lastEventStage) {
		const later = (stage: TimelineStage | undefined) => (stage ? pipeline.indexOf(stage) : -1);
		const ahead = later(lastEventStage) > later(recordedStage) ? lastEventStage : recordedStage;
		if (isActiveDeployment(deployment.status) || isStopped(deployment.status)) return ahead;
	}

	if (isActiveDeployment(deployment.status)) return recordedStage;
	if (!isStopped(deployment.status)) return undefined;
	if (recordedStage) return recordedStage;
	if (lastEventStage) return lastEventStage;

	// It never started, so it stopped while waiting in the queue.
	return deployment.started_at ? undefined : 'Queued';
}

function isStopped(status: string): boolean {
	return status === 'failed' || status === 'cancelled';
}

function getStepStatus(
	deployment: Deployment,
	stageIndex: number,
	currentIndex: number
): DeploymentStep['status'] {
	if (deployment.status === 'succeeded') return 'success';

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

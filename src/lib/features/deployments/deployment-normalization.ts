import type { Deployment, DeploymentEvent } from '$lib/api/resources/deployment';
import {
	DEPLOYMENT_PIPELINE_STAGES,
	type DeploymentPipelineStage,
	type DeploymentStage,
	type DeploymentStep
} from './type';

const EVENT_STAGE_MAP: Record<string, DeploymentStage> = {
	'deployment.queued': 'Queued',
	'deployment.cloning': 'Cloning',
	'deployment.analyzing': 'Analyzing',
	'deployment.building': 'Building',
	'deployment.deploying': 'Deploying',
	'deployment.routing': 'Routing',
	'deployment.health_checking': 'HealthChecking',
	'deployment.succeeded': 'Succeeded',
	'deployment.failed': 'Failed',
	'deployment.cancelled': 'Cancelled'
};

const STAGE_TITLE_MAP: Record<DeploymentPipelineStage, string> = {
	Queued: 'Menunggu antrian',
	Cloning: 'Cloning repository',
	Analyzing: 'Menganalisis proyek',
	Building: 'Building image',
	Deploying: 'Deploy container',
	Routing: 'Menyiapkan routing',
	HealthChecking: 'Health check - live'
};

const TERMINAL_EVENT_TYPES = new Set([
	'deployment.succeeded',
	'deployment.failed',
	'deployment.cancelled'
]);

function getStageFromEvent(event: DeploymentEvent): DeploymentStage | undefined {
	if (!event.type) return undefined;

	return EVENT_STAGE_MAP[event.type];
}

export function normalizeDeploymentTimeline(
	deployment: Deployment,
	events: DeploymentEvent[]
): DeploymentStep[] {
	const uniqueEvents = new Map<number, DeploymentEvent>();

	for (const event of events) {
		if (!uniqueEvents.has(event.sequence)) {
			uniqueEvents.set(event.sequence, event);
		}
	}

	const sortedEvents = [...uniqueEvents.values()].sort((a, b) => a.sequence - b.sequence);

	const stageEvents = new Map<DeploymentStage, DeploymentEvent>();

	for (const event of sortedEvents) {
		const stage = getStageFromEvent(event);

		if (!stage || TERMINAL_EVENT_TYPES.has(event.type ?? '')) {
			continue;
		}

		stageEvents.set(stage, event);
	}

	const currentStage = getCurrentStage(deployment, sortedEvents);

	return DEPLOYMENT_PIPELINE_STAGES.map((stage) => {
		const event = stageEvents.get(stage);

		return {
			key: stage,
			title: STAGE_TITLE_MAP[stage],
			status: getStepStatus(deployment, stage, currentStage),
			timestamp: event?.occurred_at
		};
	});
}

function getCurrentStage(
	deployment: Deployment,
	sortedEvents: DeploymentEvent[]
): DeploymentPipelineStage | undefined {
	switch (deployment.status) {
		case 'queued':
			return 'Queued';
		case 'cloning':
			return 'Cloning';
		case 'analyzing':
			return 'Analyzing';
		case 'building':
			return 'Building';
		case 'deploying':
			return 'Deploying';
		case 'routing':
			return 'Routing';
		case 'health_checking':
			return 'HealthChecking';
	}

	if (deployment.status === 'failed' || deployment.status === 'cancelled') {
		for (let i = sortedEvents.length - 1; i >= 0; i--) {
			const stage = getStageFromEvent(sortedEvents[i]);
			if (stage && isPipelineStage(stage)) {
				return stage;
			}
		}
		return undefined;
	}

	return undefined;
}

function getStepStatus(
	deployment: Deployment,
	stage: DeploymentPipelineStage,
	currentStage: DeploymentPipelineStage | undefined
): DeploymentStep['status'] {
	const stageIndex = DEPLOYMENT_PIPELINE_STAGES.indexOf(stage);
	const currentIndex = getCurrentStageIndex(currentStage);

	if (deployment.status === 'succeeded') {
		return 'success';
	}

	if (
		(deployment.status === 'failed' || deployment.status === 'cancelled') &&
		stage === currentStage
	) {
		return 'failed';
	}

	if (currentIndex >= 0 && stageIndex < currentIndex) {
		return 'success';
	}

	if (stage === currentStage && isActiveDeployment(deployment.status)) {
		return 'running';
	}

	return 'pending';
}

function isActiveDeployment(status: string): boolean {
	return [
		'queued',
		'cloning',
		'analyzing',
		'building',
		'deploying',
		'routing',
		'health_checking'
	].includes(status);
}

function getCurrentStageIndex(currentStage: DeploymentPipelineStage | undefined): number {
	return currentStage ? DEPLOYMENT_PIPELINE_STAGES.indexOf(currentStage) : -1;
}

function isPipelineStage(stage: DeploymentStage): stage is DeploymentPipelineStage {
	return (DEPLOYMENT_PIPELINE_STAGES as readonly string[]).includes(stage);
}

export function sortUniqueEvents(events: DeploymentEvent[]): DeploymentEvent[] {
	const uniqueEvents = new Map<number, DeploymentEvent>();
	for (const event of events) {
		if (!uniqueEvents.has(event.sequence)) uniqueEvents.set(event.sequence, event);
	}
	return [...uniqueEvents.values()].sort((a, b) => a.sequence - b.sequence);
}

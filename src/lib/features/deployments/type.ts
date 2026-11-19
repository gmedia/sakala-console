import type { ProjectMonorepo } from '$lib/features/projects/type';
import type { ImageSource } from './image-reuse-presentation';
export type StatusDeployment = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';

export type DeploymentStatus =
	| 'queued'
	| 'cloning'
	| 'analyzing'
	| 'building'
	| 'deploying'
	| 'routing'
	| 'health_checking'
	| 'succeeded'
	| 'failed'
	| 'cancelled';

export type DeploymentStage =
	| 'Queued'
	| 'Cloning'
	| 'Analyzing'
	| 'Building'
	| 'Deploying'
	| 'HealthChecking'
	| 'Routing'
	| 'Succeeded'
	| 'Failed'
	| 'Cancelled';

/** Health comes before routing: the agent only activates the route for an app that answered. */
export const DEPLOYMENT_PIPELINE_STAGES = [
	'Queued',
	'Cloning',
	'Analyzing',
	'Building',
	'Deploying',
	'HealthChecking',
	'Routing'
] as const satisfies readonly DeploymentPipelineStage[];

export type DeploymentPipelineStage = Extract<
	DeploymentStage,
	'Queued' | 'Cloning' | 'Analyzing' | 'Building' | 'Deploying' | 'HealthChecking' | 'Routing'
>;

/**
 * A deployment that reuses an image starts it straight away: one step stands in for checkout,
 * analysis, and build, which never run. It has no status of its own; the API stays `queued` until
 * the container starts.
 */
export const IMAGE_REUSED_STAGE = 'ImageReused';

export type TimelineStage = DeploymentPipelineStage | typeof IMAGE_REUSED_STAGE;

export const REUSED_IMAGE_PIPELINE_STAGES = [
	'Queued',
	IMAGE_REUSED_STAGE,
	'Deploying',
	'HealthChecking',
	'Routing'
] as const satisfies readonly TimelineStage[];

export type DeploymentStep = {
	key: string;
	title: string;
	status: StatusDeployment;
	timestamp?: string;
	/** Only for a stage that ended and whose start is on record. */
	durationSeconds?: number;
	/** On the analysis step: the JavaScript workspace this deployment built from, and its commands. */
	monorepo?: ProjectMonorepo;
	/** On the step of a reused image: the deployment that built it, which the title links to. */
	imageSource?: ImageSource;
};

export type DeploymentEventLevel = 'info' | 'warning' | 'error';

export type DeploymentEventType =
	| 'deployment.checkout.started'
	| 'deployment.build.started'
	| 'deployment.container.started'
	| 'deployment.runtime.ready'
	| 'deployment.succeeded'
	| 'deployment.failed'
	| 'deployment.cancelled'
	| 'deployment.cloning'
	| 'deployment.building'
	| null;

export type LogStream = 'stdout' | 'stderr' | 'system';

export type BackendLogLine = {
	sequence: number;
	stream: LogStream;
	message: string;
	recorded_at: string;
};

export type DeployLogLine = {
	timestamp: string;
	message: string;
	variant?: 'error';
};

export type DeploymentProgress = {
	stage: DeploymentStage;
	steps: DeploymentStep[];
	logs: DeployLogLine[];
	errorMessage?: string;
};

export type StatusDeployment = 'pending' | 'running' | 'success' | 'failed';

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
	| 'Building'
	| 'Deploying'
	| 'Routing'
	| 'Succeeded'
	| 'Failed'
	| 'Cancelled';

export const DEPLOYMENT_PIPELINE_STAGES = [
	'Queued',
	'Cloning',
	'Building',
	'Deploying',
	'Routing'
] as const satisfies readonly DeploymentPipelineStage[];

export type DeploymentPipelineStage = Extract<
	DeploymentStage,
	'Queued' | 'Cloning' | 'Building' | 'Deploying' | 'Routing'
>;

export type DeploymentStep = {
	key: string;
	title: string;
	status: StatusDeployment;
	timestamp?: string;
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

export type MockDeploymentEvent = {
	sequence: number;
	level: DeploymentEventLevel;
	type: DeploymentEventType;
	message: string;
	metadata: Record<string, unknown> | null;
	occurred_at: string;
};

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

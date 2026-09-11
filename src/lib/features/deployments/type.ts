export type StatusDeployment = 'pending' | 'running' | 'success' | 'failed';

export type DeploymentStage =
	| 'Queued'
	| 'Cloning'
	| 'Analyzing'
	| 'Building'
	| 'Deploying'
	| 'Routing'
	| 'HealthChecking'
	| 'Succeeded'
	| 'Failed'
	| 'Cancelled';

export const DEPLOYMENT_PIPELINE_STAGES = [
	'Queued',
	'Cloning',
	'Analyzing',
	'Building',
	'Deploying',
	'Routing',
	'HealthChecking'
] as const satisfies readonly DeploymentStage[];

export type DeploymentStep = {
	key: string;
	title: string;
	status: StatusDeployment;
	timestamp?: string;
};

export type DeploymentEventLevel = 'info' | 'warning' | 'error';

export type DeploymentEventType =
	| 'deployment.cloning'
	| 'deployment.analyzing'
	| 'deployment.building'
	| 'deployment.deploying'
	| 'deployment.routing'
	| 'deployment.health_checking'
	| 'deployment.succeeded'
	| 'deployment.failed';

export type DeploymentEvent = {
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

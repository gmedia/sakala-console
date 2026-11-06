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

export type DeploymentStep = {
	key: string;
	title: string;
	status: StatusDeployment;
	timestamp?: string;
	/** Only for a stage that ended and whose start is on record. */
	durationSeconds?: number;
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

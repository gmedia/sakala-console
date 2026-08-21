import type { DeploymentStep } from '../type';

export type DeploymentEventLevel = 'info' | 'warning' | 'error';

export type DeploymentEvent = {
	sequence: number;
	level: DeploymentEventLevel;
	type: string;
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

export type DeployScenario = 'success' | 'failed';

export type DeploymentProgress = {
	steps: DeploymentStep[];
	logs: DeployLogLine[];
	errorMessage?: string;
};

function formatTime(isoString: string): string {
	return new Date(isoString).toLocaleTimeString('id-ID', { hour12: false });
}

function toDeployLogLine(raw: BackendLogLine): DeployLogLine {
	return {
		timestamp: formatTime(raw.recorded_at),
		message: raw.message,
		variant: raw.stream === 'stderr' ? 'error' : undefined
	};
}

const STEP_ORDER: { key: string; title: string; eventType: string }[] = [
	{ key: 'clone', title: 'Cloning repository', eventType: 'deployment.cloning' },
	{ key: 'analyze', title: 'Menganalisis proyek', eventType: 'deployment.analyzing' },
	{ key: 'build', title: 'Building image', eventType: 'deployment.building' },
	{ key: 'deploy', title: 'Deploy container', eventType: 'deployment.deploying' },
	{ key: 'health', title: 'Health check - live', eventType: 'deployment.health_checking' }
];

export function deriveStepsFromEvents(events: DeploymentEvent[]): DeploymentStep[] {
	let currentStepIndex = -1;
	let finalStatus: 'success' | 'failed' | null = null;

	for (const event of events) {
		const stepIdx = STEP_ORDER.findIndex((s) => s.eventType === event.type);
		if (stepIdx !== -1) {
			currentStepIndex = stepIdx;
		} else if (event.type === 'deployment.succeeded') {
			finalStatus = 'success';
		} else if (event.type === 'deployment.failed') {
			finalStatus = 'failed';
		}
	}

	return STEP_ORDER.map((step, idx) => {
		if (finalStatus === 'success') {
			return { key: step.key, title: step.title, status: 'success' as const };
		}
		if (idx < currentStepIndex) {
			return { key: step.key, title: step.title, status: 'success' as const };
		}
		if (idx === currentStepIndex) {
			return {
				key: step.key,
				title: step.title,
				status: finalStatus === 'failed' ? ('failed' as const) : ('running' as const)
			};
		}
		return { key: step.key, title: step.title, status: 'pending' as const };
	});
}

function deriveErrorMessage(events: DeploymentEvent[]): string | undefined {
	const failedEvent = events.find((e) => e.type === 'deployment.failed');
	return failedEvent?.message;
}

const successEvents: DeploymentEvent[] = [
	{
		sequence: 1,
		level: 'info',
		type: 'deployment.cloning',
		message: 'Cloning repository',
		metadata: null,
		occurred_at: '2026-08-21T08:41:02Z'
	},
	{
		sequence: 2,
		level: 'info',
		type: 'deployment.analyzing',
		message: 'Menganalisis proyek',
		metadata: null,
		occurred_at: '2026-08-21T08:41:06Z'
	},
	{
		sequence: 3,
		level: 'info',
		type: 'deployment.building',
		message: 'Building image',
		metadata: null,
		occurred_at: '2026-08-21T08:41:10Z'
	},
	{
		sequence: 4,
		level: 'info',
		type: 'deployment.deploying',
		message: 'Deploy container',
		metadata: null,
		occurred_at: '2026-08-21T08:41:20Z'
	},
	{
		sequence: 5,
		level: 'info',
		type: 'deployment.health_checking',
		message: 'Menjalankan health check',
		metadata: null,
		occurred_at: '2026-08-21T08:41:27Z'
	},
	{
		sequence: 6,
		level: 'info',
		type: 'deployment.succeeded',
		message: 'Deployment berhasil, container live',
		metadata: null,
		occurred_at: '2026-08-21T08:41:30Z'
	}
];

const failedEvents: DeploymentEvent[] = [
	{
		sequence: 1,
		level: 'info',
		type: 'deployment.cloning',
		message: 'Cloning repository',
		metadata: null,
		occurred_at: '2026-08-21T08:41:02Z'
	},
	{
		sequence: 2,
		level: 'info',
		type: 'deployment.analyzing',
		message: 'Menganalisis proyek',
		metadata: null,
		occurred_at: '2026-08-21T08:41:06Z'
	},
	{
		sequence: 3,
		level: 'info',
		type: 'deployment.building',
		message: 'Building image',
		metadata: null,
		occurred_at: '2026-08-21T08:41:10Z'
	},
	{
		sequence: 4,
		level: 'error',
		type: 'deployment.failed',
		message: "Cannot find module 'package.json'\nBuild failed with exit code 1",
		metadata: null,
		occurred_at: '2026-08-21T08:41:15Z'
	}
];

const successLogs: BackendLogLine[] = [
	{
		sequence: 1,
		stream: 'system',
		message: 'Cloning GMedia/Sakala 2@main...',
		recorded_at: '2026-08-21T08:41:02Z'
	},
	{
		sequence: 2,
		stream: 'system',
		message: 'Dockerfile detected, using custom builder',
		recorded_at: '2026-08-21T08:41:05Z'
	},
	{
		sequence: 3,
		stream: 'stdout',
		message: 'Step 1/6 : FROM node:20-alpine',
		recorded_at: '2026-08-21T08:41:08Z'
	},
	{
		sequence: 4,
		stream: 'stdout',
		message: 'Step 4/6 : RUN npm install',
		recorded_at: '2026-08-21T08:41:11Z'
	},
	{
		sequence: 5,
		stream: 'stdout',
		message: 'Build finished successfully',
		recorded_at: '2026-08-21T08:41:20Z'
	},
	{
		sequence: 6,
		stream: 'system',
		message: 'Container started, listening on port 3000',
		recorded_at: '2026-08-21T08:41:25Z'
	},
	{
		sequence: 7,
		stream: 'system',
		message: 'Health check passed, deployment live',
		recorded_at: '2026-08-21T08:41:30Z'
	}
];

const failedLogs: BackendLogLine[] = [
	{
		sequence: 1,
		stream: 'system',
		message: 'Cloning GMedia/Sakala 2@main...',
		recorded_at: '2026-08-21T08:41:02Z'
	},
	{
		sequence: 2,
		stream: 'system',
		message: 'Dockerfile detected, using custom builder',
		recorded_at: '2026-08-21T08:41:05Z'
	},
	{
		sequence: 3,
		stream: 'stdout',
		message: 'Step 1/6 : FROM node:20-alpine',
		recorded_at: '2026-08-21T08:41:08Z'
	},
	{
		sequence: 4,
		stream: 'stdout',
		message: 'Step 4/6 : RUN npm install',
		recorded_at: '2026-08-21T08:41:11Z'
	},
	{
		sequence: 5,
		stream: 'stderr',
		message: "Error: Cannot find module 'package.json'",
		recorded_at: '2026-08-21T08:41:15Z'
	},
	{
		sequence: 6,
		stream: 'stderr',
		message: 'Build failed with exit code 1',
		recorded_at: '2026-08-21T08:41:15Z'
	}
];

const scenarioEvents: Record<DeployScenario, DeploymentEvent[]> = {
	success: successEvents,
	failed: failedEvents
};

const scenarioLogs: Record<DeployScenario, BackendLogLine[]> = {
	success: successLogs,
	failed: failedLogs
};

export function resolveDeployScenario(successRate = 0.8): DeployScenario {
	return Math.random() < successRate ? 'success' : 'failed';
}

export async function* streamDeploymentProgress(
	scenario: DeployScenario = 'success'
): AsyncGenerator<DeploymentProgress> {
	const events = scenarioEvents[scenario];
	const logs = scenarioLogs[scenario];

	const receivedEvents: DeploymentEvent[] = [];
	let shownLogCount = 0;

	for (let i = 0; i < events.length; i++) {
		await new Promise((resolve) => setTimeout(resolve, 500));

		receivedEvents.push(events[i]);

		shownLogCount = Math.max(shownLogCount, Math.floor(((i + 1) / events.length) * logs.length));

		yield {
			steps: deriveStepsFromEvents(receivedEvents),
			logs: logs.slice(0, shownLogCount).map(toDeployLogLine),
			errorMessage: deriveErrorMessage(receivedEvents)
		};

		await new Promise((resolve) => setTimeout(resolve, 800));

		if (events[i].type === 'deployment.failed') break;
	}
}

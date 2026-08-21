import type { DeploymentStep } from '../type';

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

const baseLogsBeforeBuild: DeployLogLine[] = [
	{ timestamp: '08:41:02', message: 'Cloning GMedia/Sakala 2@main...' },
	{ timestamp: '08:41:05', message: 'Dockerfile detected, using custom builder' },
	{ timestamp: '08:41:08', message: 'Step 1/6 : FROM node:20-alpine' },
	{ timestamp: '08:41:11', message: 'Step 4/6 : RUN npm install' }
];

const successScenario: DeploymentProgress = {
	steps: [
		{ key: 'clone', title: 'Cloning repository', status: 'success' },
		{ key: 'analyze', title: 'Menganalisis proyek', status: 'success' },
		{ key: 'build', title: 'Building image', status: 'success' },
		{ key: 'deploy', title: 'Deploy container', status: 'success' },
		{ key: 'health', title: 'Health check - live', status: 'success' }
	],
	logs: [
		...baseLogsBeforeBuild,
		{ timestamp: '08:41:20', message: 'Build finished successfully' },
		{ timestamp: '08:41:25', message: 'Container started, listening on port 3000' },
		{ timestamp: '08:41:30', message: 'Health check passed, deployment live' }
	]
};

const failedScenario: DeploymentProgress = {
	steps: [
		{ key: 'clone', title: 'Cloning repository', status: 'success' },
		{ key: 'analyze', title: 'Menganalisis proyek', status: 'success' },
		{ key: 'build', title: 'Building image', status: 'success' },
		{ key: 'deploy', title: 'Deploy container', status: 'failed' },
		{ key: 'health', title: 'Health check - live', status: 'pending' }
	],
	logs: [
		...baseLogsBeforeBuild,
		{
			timestamp: '08:41:15',
			message: "Error: Cannot find module 'package.json'",
			variant: 'error'
		},
		{ timestamp: '08:41:15', message: 'Build failed with exit code 1', variant: 'error' }
	],
	errorMessage: "Cannot find module 'package.json'\nBuild failed with exit code 1"
};

const scenarios: Record<DeployScenario, DeploymentProgress> = {
	success: successScenario,
	failed: failedScenario
};

export function resolveDeployScenario(successRate = 0.8): DeployScenario {
	return Math.random() < successRate ? 'success' : 'failed';
}

export async function* streamDeploymentProgress(
	scenario: DeployScenario = 'success'
): AsyncGenerator<DeploymentProgress> {
	const target = scenarios[scenario];
	let shownLogCount = 0;

	for (let i = 0; i < target.steps.length; i++) {
		const currentStep = target.steps[i];
		const isFailingStep = currentStep.status === 'failed';

		await new Promise((resolve) => setTimeout(resolve, 500));

		const runningSteps = target.steps.map((step, idx) => {
			if (idx < i) return step;
			if (idx === i) return { ...step, status: 'running' as const };
			return { ...step, status: 'pending' as const };
		});

		shownLogCount = Math.max(
			shownLogCount,
			Math.floor((i / target.steps.length) * target.logs.length)
		);

		yield {
			steps: runningSteps,
			logs: target.logs.slice(0, shownLogCount),
			errorMessage: undefined
		};

		await new Promise((resolve) => setTimeout(resolve, 800));

		const finalizedSteps = target.steps.map((step, idx) => {
			if (idx <= i) return step;
			return { ...step, status: 'pending' as const };
		});

		shownLogCount = Math.max(
			shownLogCount,
			Math.ceil(((i + 1) / target.steps.length) * target.logs.length)
		);

		yield {
			steps: finalizedSteps,
			logs: target.logs.slice(0, shownLogCount),
			errorMessage: isFailingStep ? target.errorMessage : undefined
		};

		if (isFailingStep) break;
	}
}

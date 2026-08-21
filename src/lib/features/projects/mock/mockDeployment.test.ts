import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	resolveDeployScenario,
	streamDeploymentProgress,
	type DeploymentProgress
} from './mockDeployment';

describe('resolveDeployScenario', () => {
	it('should return success when successRate is 1', () => {
		for (let i = 0; i < 20; i++) {
			expect(resolveDeployScenario(1)).toBe('success');
		}
	});

	it('should return failed when successRate is 0', () => {
		for (let i = 0; i < 20; i++) {
			expect(resolveDeployScenario(0)).toBe('failed');
		}
	});
});

describe('streamDeploymentProgress', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	async function collectAllProgress(scenario?: 'success' | 'failed') {
		const results: DeploymentProgress[] = [];
		const gen = streamDeploymentProgress(scenario);

		let next = gen.next();
		while (true) {
			await vi.advanceTimersByTimeAsync(1300);
			const result = await next;
			if (result.done) break;
			results.push(result.value);
			next = gen.next();
		}
		return results;
	}

	it('default scenario should be success when no argument is passed', async () => {
		const progressList = await collectAllProgress();
		const final = progressList[progressList.length - 1];

		expect(final.steps.every((s) => s.status === 'success')).toBe(true);
	});

	it('scenario success: all steps should be completed successfully', async () => {
		const progressList = await collectAllProgress('success');
		const finalProgress = progressList[progressList.length - 1];

		expect(finalProgress.steps.every((s) => s.status === 'success')).toBe(true);
		expect(finalProgress.errorMessage).toBeUndefined();
		expect(finalProgress.logs.length).toBeGreaterThan(0);
	});

	it('scenario success: yields exactly one progress per event (6 events)', async () => {
		const progressList = await collectAllProgress('success');
		expect(progressList.length).toBe(6);
	});

	it('scenario failed: build step fails, deploy and health remain pending', async () => {
		const progressList = await collectAllProgress('failed');
		const finalProgress = progressList[progressList.length - 1];

		const buildStep = finalProgress.steps.find((s) => s.key === 'build');
		const deployStep = finalProgress.steps.find((s) => s.key === 'deploy');
		const healthStep = finalProgress.steps.find((s) => s.key === 'health');

		expect(buildStep?.status).toBe('failed');
		expect(deployStep?.status).toBe('pending');
		expect(healthStep?.status).toBe('pending');
	});

	it('scenario failed: clone and analyze steps remain success before the failing step', async () => {
		const progressList = await collectAllProgress('failed');
		const finalProgress = progressList[progressList.length - 1];

		const cloneStep = finalProgress.steps.find((s) => s.key === 'clone');
		const analyzeStep = finalProgress.steps.find((s) => s.key === 'analyze');

		expect(cloneStep?.status).toBe('success');
		expect(analyzeStep?.status).toBe('success');
	});

	it('scenario failed: error message shown in last yielded progress', async () => {
		const progressList = await collectAllProgress('failed');
		const finalProgress = progressList[progressList.length - 1];

		expect(finalProgress.errorMessage).toContain("Cannot find module 'package.json'");
	});

	it('scenario failed: stops right after deployment.failed event', async () => {
		const progressList = await collectAllProgress('failed');
		expect(progressList.length).toBe(4);
	});

	it('scenario failed: no yeild after failing step', async () => {
		const progressList = await collectAllProgress('failed');
		const successProgressList = await collectAllProgress('success');
		expect(progressList.length).toBeLessThan(successProgressList.length);
	});

	it('scenario failed: all logs including stderr lines are shown by the end', async () => {
		const progressList = await collectAllProgress('failed');
		const finalProgress = progressList[progressList.length - 1];

		expect(finalProgress.logs.length).toBe(6);
		const errorLogs = finalProgress.logs.filter((log) => log.variant === 'error');
		expect(errorLogs.length).toBe(2);
	});

	it('logs should be yielded progressively and include all lines by the end', async () => {
		const progressList = await collectAllProgress('success');
		const logCounts = progressList.map((p) => p.logs.length);

		for (let i = 1; i < logCounts.length; i++) {
			expect(logCounts[i]).toBeGreaterThanOrEqual(logCounts[i - 1]);
		}

		const finalLogCount = logCounts[logCounts.length - 1];
		expect(finalLogCount).toBe(7);
	});
});

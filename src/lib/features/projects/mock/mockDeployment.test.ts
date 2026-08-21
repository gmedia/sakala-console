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

	async function collectAllProgress(scenario: 'success' | 'failed') {
		const results: DeploymentProgress[] = [];
		const gen = streamDeploymentProgress(scenario);

		let next = gen.next();
		while (true) {
			await vi.advanceTimersByTimeAsync(800);
			const result = await next;
			if (result.done) break;
			results.push(result.value);
			next = gen.next();
		}
		return results;
	}

	it('default scenario should be success when no argument is passed', async () => {
		const results: DeploymentProgress[] = [];
		const gen = streamDeploymentProgress();
		let next = gen.next();
		while (true) {
			await vi.advanceTimersByTimeAsync(800);
			const result = await next;
			if (result.done) break;
			results.push(result.value);
			next = gen.next();
		}
		const final = results[results.length - 1];
		expect(final.steps.every((s) => s.status === 'success')).toBe(true);
	});

	it('scenario success: all steps should be completed successfully', async () => {
		const progressList = await collectAllProgress('success');
		const finalProgress = progressList[progressList.length - 1];

		expect(finalProgress.steps.every((s) => s.status === 'success')).toBe(true);
		expect(finalProgress.errorMessage).toBeUndefined();
		expect(finalProgress.logs.length).toBeGreaterThan(0);
	});

	it('scenario failed: deploy step transitions from running to failed', async () => {
		const gen = streamDeploymentProgress('failed');
		const allYields: DeploymentProgress[] = [];
		let next = gen.next();
		while (true) {
			await vi.advanceTimersByTimeAsync(800);
			const result = await next;
			if (result.done) break;
			allYields.push(result.value);
			next = gen.next();
		}
		const deployRunningYield = allYields[6].steps.find((s) => s.key === 'deploy');
		const deployFinalYield = allYields[7].steps.find((s) => s.key === 'deploy');

		expect(deployRunningYield?.status).toBe('running');
		expect(deployFinalYield?.status).toBe('failed');
	});

	it('scenario failed: should stop at the failing step', async () => {
		const progressList = await collectAllProgress('failed');
		const finalProgress = progressList[progressList.length - 1];

		const deployStep = finalProgress.steps.find((s) => s.key === 'deploy');
		const healthStep = finalProgress.steps.find((s) => s.key === 'health');

		expect(deployStep?.status).toBe('failed');
		expect(healthStep?.status).toBe('pending');
	});

	it('scenario failed: error message show in last yielded progress', async () => {
		const progressList = await collectAllProgress('failed');
		const finalProgress = progressList[progressList.length - 1];

		expect(finalProgress.errorMessage).toContain("Cannot find module 'package.json'");
	});

	it('scenario failed: no yeild after failing step', async () => {
		const progressList = await collectAllProgress('failed');
		const successProgressList = await collectAllProgress('success');
		expect(progressList.length).toBeLessThan(successProgressList.length);
	});

	it('logs should be yielded progressively', async () => {
		const progressList = await collectAllProgress('success');
		const logCounts = progressList.map((p) => p.logs.length);

		for (let i = 1; i < logCounts.length; i++) {
			expect(logCounts[i]).toBeGreaterThanOrEqual(logCounts[i - 1]);
		}
	});
});

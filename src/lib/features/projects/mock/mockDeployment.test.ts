import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveDeployScenario, streamDeploymentProgress } from './mockDeployment';
import type { DeploymentProgress } from '$lib/features/deployments/type';

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

	async function collectAllProgress(scenario?: 'success' | 'failed', initialTime = Date.now()) {
		vi.setSystemTime(initialTime);
		const results: DeploymentProgress[] = [];
		const gen = streamDeploymentProgress(scenario);

		while (true) {
			const nextPromise = gen.next();
			await vi.runAllTimersAsync();
			const result = await nextPromise;
			if (result.done) break;
			results.push(result.value);
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

	it('scenario success: yields exactly one progress per event (5 events)', async () => {
		const progressList = await collectAllProgress('success');
		expect(progressList.length).toBe(5);
	});

	it('scenario failed: build step fails, deploy and routing remain pending', async () => {
		const progressList = await collectAllProgress('failed');
		const finalProgress = progressList[progressList.length - 1];

		const buildStep = finalProgress.steps.find((s) => s.key === 'build');
		const deployStep = finalProgress.steps.find((s) => s.key === 'deploy');
		const routingStep = finalProgress.steps.find((s) => s.key === 'routing');

		expect(buildStep?.status).toBe('failed');
		expect(deployStep?.status).toBe('pending');
		expect(routingStep?.status).toBe('pending');
	});

	it('scenario failed: clone step remains success before the failing step', async () => {
		const progressList = await collectAllProgress('failed');
		const finalProgress = progressList[progressList.length - 1];

		const cloneStep = finalProgress.steps.find((s) => s.key === 'clone');

		expect(cloneStep?.status).toBe('success');
	});

	it('scenario failed: error message shown in last yielded progress', async () => {
		const progressList = await collectAllProgress('failed');
		const finalProgress = progressList[progressList.length - 1];

		expect(finalProgress.errorMessage).toContain("Cannot find module 'package.json'");
	});

	it('scenario failed: stops right after deployment.failed event', async () => {
		const progressList = await collectAllProgress('failed');
		expect(progressList.length).toBe(3);
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

	it('live logs should use runtime timestamps', async () => {
		const startedAt = new Date('2026-09-13T02:00:00.000Z').getTime();

		const progressList = await collectAllProgress('success');
		const finalProgress = progressList[progressList.length - 1];

		for (const log of finalProgress.logs) {
			expect(new Date(log.timestamp).getTime()).toBeGreaterThanOrEqual(startedAt);
		}
	});

	it('live success: terminal timestamp is within the startedAt..clock range when the terminal yields.', async () => {
		const startedAt = new Date('2026-09-13T02:00:00.000Z').getTime();
		vi.setSystemTime(startedAt);

		const results: DeploymentProgress[] = [];
		const gen = streamDeploymentProgress('success');
		let next = gen.next();
		let clockAtLastYield = startedAt;

		while (true) {
			await vi.advanceTimersByTimeAsync(1300);
			const result = await next;
			if (result.done) break;
			results.push(result.value);
			clockAtLastYield = Date.now();
			next = gen.next();
		}

		const finalProgress = results[results.length - 1];
		const finalLog = finalProgress.logs[finalProgress.logs.length - 1];
		const finalLogTime = new Date(finalLog.timestamp).getTime();

		expect(finalLogTime).toBeGreaterThanOrEqual(startedAt);
		expect(finalLogTime).toBeLessThanOrEqual(clockAtLastYield);
	});

	it('for every step of progress: the timestamp logs that appear are never ahead of the current fake clock.', async () => {
		const startedAt = new Date('2026-09-13T02:00:00.000Z').getTime();
		vi.setSystemTime(startedAt);

		const gen = streamDeploymentProgress('success');
		let next = gen.next();

		while (true) {
			await vi.advanceTimersByTimeAsync(1300);
			const result = await next;
			if (result.done) break;

			const now = Date.now();
			for (const log of result.value.logs) {
				const logTime = new Date(log.timestamp).getTime();
				expect(logTime).toBeLessThanOrEqual(now);
				expect(logTime).toBeGreaterThanOrEqual(startedAt);
			}

			next = gen.next();
		}
	});
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { detectProjectConfig, pickRandomScenario } from './mockDetectConfig';
import { mockRepositories } from './mock';

describe('detectProjectConfig', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	const repository = mockRepositories[0];
	const branch = 'main';
	const port = '8080';

	async function runScan(...args: Parameters<typeof detectProjectConfig>) {
		const promise = detectProjectConfig(...args);
		await vi.runAllTimers();
		return promise;
	}

	describe('scenario: failed', () => {
		it('should with an error message', async () => {
			await expect(runScan(repository, branch, port, 'failed')).rejects.toThrow(
				`Gagal menganalisis repository ${repository.full_name ?? 'tidak diketahui'}. Coba scan ulang.`
			);
		});

		it('includes repository full name in the error message when repository is provided', async () => {
			await expect(runScan(repository, branch, port, 'failed')).rejects.toThrow(
				`Gagal menganalisis repository ${repository.full_name}. Coba scan ulang.`
			);
		});

		it('falls back gracefully in the error message when repository is null', async () => {
			await expect(runScan(null, branch, port, 'failed')).rejects.toThrow(
				'Gagal menganalisis repository tidak diketahui. Coba scan ulang.'
			);
		});
	});

	describe('scenario: no-dockerfile', () => {
		it('returns hasDockerfile false', async () => {
			const result = await runScan(repository, branch, port, 'no-dockerfile');
			expect(result.hasDockerfile).toBe(false);
		});

		it('returns detectedBranch matching the branch argument', async () => {
			const result = await runScan(repository, 'develop', port, 'no-dockerfile');
			expect(result.detectedBranch).toBe('develop');
		});

		it('keeps currentPort when provided', async () => {
			const result = await runScan(repository, branch, '8080', 'no-dockerfile');
			expect(result.detectedPort).toBe('8080');
		});

		it('falls back to 3000 when currentPort is empty', async () => {
			const result = await runScan(repository, branch, '', 'no-dockerfile');
			expect(result.detectedPort).toBe('3000');
		});
	});

	describe('scenario: undefined (random flow use runScan)', () => {
		afterEach(() => {
			vi.restoreAllMocks();
		});

		it('resolves hasDockerfile true when random roll lands in the dockerfile range', async () => {
			vi.spyOn(Math, 'random').mockReturnValueOnce(0.5).mockReturnValueOnce(0.9);

			const result = await runScan(repository, branch, port, undefined, 1);
			expect(result.hasDockerfile).toBe(true);
		});

		it('rejects when random roll lands in the failed range for attempt 1', async () => {
			vi.spyOn(Math, 'random').mockReturnValueOnce(0.5).mockReturnValueOnce(0.1);

			await expect(runScan(repository, branch, port, undefined, 1)).rejects.toThrow(
				`Gagal menganalisis repository ${repository.full_name ?? 'tidak diketahui'}. Coba scan ulang.`
			);
		});

		it('resolves successfully on attempt 2 with a roll that would have failed on attempt 1', async () => {
			vi.spyOn(Math, 'random').mockReturnValueOnce(0.5).mockReturnValueOnce(0.3);

			const result = await runScan(repository, branch, port, undefined, 2);
			expect(result.hasDockerfile).toBe(true);
		});

		it('defaults attempt to 1 when not provided', async () => {
			vi.spyOn(Math, 'random').mockReturnValueOnce(0.5).mockReturnValueOnce(0.1);

			await expect(runScan(repository, branch, port)).rejects.toThrow(
				`Gagal menganalisis repository ${repository.full_name ?? 'tidak diketahui'}. Coba scan ulang.`
			);
		});
	});

	describe('pickRandomScenario', () => {
		afterEach(() => {
			vi.restoreAllMocks();
		});

		it('returns "failed" when roll is below failChance for attempt 1 (0.4)', () => {
			vi.spyOn(Math, 'random').mockReturnValue(0.1);
			expect(pickRandomScenario(1)).toBe('failed');
		});

		it('returns "no-dockerfile" when roll is between failChance and failChance + 0.15 for attempt 1', () => {
			vi.spyOn(Math, 'random').mockReturnValue(0.45);
			expect(pickRandomScenario(1)).toBe('no-dockerfile');
		});

		it('returns "dockerfile" when roll is above both ranges for attempt 1', () => {
			vi.spyOn(Math, 'random').mockReturnValue(0.9);
			expect(pickRandomScenario(1)).toBe('dockerfile');
		});

		it('returns "failed" only within the smaller range (0.1) for attempt > 1', () => {
			vi.spyOn(Math, 'random').mockReturnValue(0.05);
			expect(pickRandomScenario(2)).toBe('failed');
		});

		it('does not return "failed" for a roll that would fail on attempt 1 but not on attempt 2', () => {
			vi.spyOn(Math, 'random').mockReturnValue(0.2);
			expect(pickRandomScenario(1)).toBe('failed');
			expect(pickRandomScenario(2)).not.toBe('failed');
		});
	});

	describe('timing', () => {
		it('does not resolve before the simulated delay', async () => {
			let resolved = false;
			detectProjectConfig(repository, branch, port, 'dockerfile').then(() => {
				resolved = true;
			});

			await vi.advanceTimersByTimeAsync(2999);
			expect(resolved).toBe(false);

			await vi.runAllTimersAsync();
			expect(resolved).toBe(true);
		});
	});
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { detectProjectConfig } from './mockDetectConfig';
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

	describe('scenario: dockerfile / default (no scenario)', () => {
		it('returns hasDockerfile true when scenario is dockerfile', async () => {
			const result = await runScan(repository, branch, port, 'dockerfile');
			expect(result.hasDockerfile).toBe(true);
		});

		it('returns hasDockerfile true when no scenario is specified', async () => {
			const result = await runScan(repository, branch, port);
			expect(result.hasDockerfile).toBe(true);
		});

		it('returns detectedPort as 3000 regardless of currentPort', async () => {
			const result = await runScan(repository, branch, '8080', 'dockerfile');
			expect(result.detectedPort).toBe('3000');
		});

		it('returns detectedBranch matching the branch argument', async () => {
			const result = await runScan(repository, 'staging', port, 'dockerfile');
			expect(result.detectedBranch).toBe('staging');
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

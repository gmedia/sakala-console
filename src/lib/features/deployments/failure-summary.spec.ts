import { describe, expect, it } from 'vitest';
import type { DeploymentLogLine } from './deployment-logs';
import {
	buildFailureSummary,
	FAILURE_SUMMARY_LOG_LINES,
	FAILURE_SUMMARY_WARNING
} from './failure-summary';
import { REDACTED } from './redact-secrets';

const line = (sequence: number, stream: DeploymentLogLine['stream'], message: string) => ({
	sequence,
	stream,
	message,
	recorded_at: '2026-09-20T08:41:22.000000Z'
});

const deployment = {
	sequence: 5,
	branch: 'main',
	commit_sha: 'a3f2c9d4e5f60718293a4b5c6d7e8f9012345678',
	failure_code: 'runtime_build_failed',
	failure_summary: 'Proses build aplikasi berhenti sebelum selesai.',
	failure: {
		code: 'runtime_build_failed',
		category: 'build',
		summary: 'Proses build aplikasi berhenti sebelum selesai.',
		recovery_hint: 'Buka log, perbaiki di repository, lalu deploy ulang.',
		user_fixable: true,
		detail: 'exit code: 1',
		stage: 'building' as const
	}
};

describe('buildFailureSummary', () => {
	const text = buildFailureSummary({
		projectName: 'toko-kopi-web',
		deployment,
		stageLines: [
			line(1, 'stdout', 'Railpack 0.9.2'),
			line(2, 'stderr', 'Reading postgres://kopi:rahasia@db:5432/kopi'),
			line(3, 'stderr', 'error during build:'),
			line(4, 'system', 'cleanup warning')
		]
	});

	it('names the project, deployment, stage, code, summary, hint, and detail', () => {
		expect(text).toContain(
			'Deployment #5 proyek toko-kopi-web gagal (branch main, commit a3f2c9d).'
		);
		expect(text).toContain('Tahap: Build proyek');
		expect(text).toContain('Kode: runtime_build_failed');
		expect(text).toContain('Ringkasan: Proses build aplikasi berhenti sebelum selesai.');
		expect(text).toContain('Cara memperbaiki: Buka log');
		expect(text).toContain('Detail: exit code: 1');
	});

	it('includes only stderr lines, masked, and ends with the reminder to check', () => {
		expect(text).toContain('Baris stderr terakhir dari tahap itu (2):');
		expect(text).toContain(`postgres://kopi:${REDACTED}@db`);
		expect(text).not.toContain(':rahasia@');
		expect(text).not.toContain('Railpack 0.9.2');
		expect(text).not.toContain('cleanup warning');
		expect(text.endsWith(FAILURE_SUMMARY_WARNING)).toBe(true);
	});

	it(`keeps at most the last ${FAILURE_SUMMARY_LOG_LINES} stderr lines`, () => {
		const many = Array.from({ length: 50 }, (_, i) => line(i + 1, 'stderr', `baris ${i + 1}`));
		const summary = buildFailureSummary({ projectName: 'x', deployment, stageLines: many });
		expect(summary).toContain(`(${FAILURE_SUMMARY_LOG_LINES}):`);
		expect(summary).toContain('baris 50');
		expect(summary).not.toContain('baris 20\n');
	});
});

import { describe, expect, it } from 'vitest';
import {
	getDetectedBuilder,
	getDetectedFramework,
	getDetectedPackageManager,
	getInspectedFiles,
	getInspectionFailureMessage,
	getInspectionNotes,
	getInspectionState,
	getPortDescription
} from './inspection-presentation';
import type { Project } from './type';

const inspection = {
	repository_url: 'https://github.com/org/app.git',
	commit_sha: '0123456789abcdef',
	dockerfile_found: false,
	env_example_found: false,
	compose_found: false,
	manifests: ['package.json'],
	package_manager: 'pnpm',
	inspected_at: '2026-11-06T00:00:00Z'
};

const stack = {
	builder: 'railpack',
	provider: 'node',
	framework: null,
	package_manager: 'pnpm'
} as const;

describe('getInspectionState', () => {
	it.each([
		['pending', 'pending'],
		['succeeded', 'succeeded'],
		['failed', 'failed'],
		['unavailable', 'failed'],
		['something-new', 'failed']
	])('reads %s as %s', (status, expected) => {
		expect(getInspectionState({ preview_status: status })).toBe(expected);
	});
});

describe('detected values stay honest', () => {
	it('names the builder the API reported', () => {
		expect(getDetectedBuilder({ preview_status: 'succeeded', stack })).toEqual({
			kind: 'known',
			text: 'Build otomatis dengan Railpack'
		});
		expect(
			getDetectedBuilder({
				preview_status: 'succeeded',
				stack: { ...stack, builder: 'dockerfile' }
			})
		).toEqual({ kind: 'known', text: 'Dockerfile terdeteksi' });
	});

	it('keeps a null framework unknown, and never derives one from the provider', () => {
		expect(getDetectedFramework({ preview_status: 'succeeded', stack })).toEqual({
			kind: 'unknown',
			text: 'Belum diketahui'
		});
	});

	it('a finished inspection with no stack summary is unknown, not undetected', () => {
		expect(getDetectedBuilder({ preview_status: 'succeeded', stack: null })).toEqual({
			kind: 'unknown',
			text: 'Belum diketahui'
		});
	});

	it('a failed inspection says it detected nothing', () => {
		expect(getDetectedBuilder({ preview_status: 'failed', stack: null })).toEqual({
			kind: 'unknown',
			text: 'Tidak terdeteksi'
		});
	});

	it('falls back to the inspection for the package manager', () => {
		expect(
			getDetectedPackageManager({ preview_status: 'succeeded', stack: null, inspection })
		).toEqual({ kind: 'known', text: 'pnpm' });
	});
});

describe('getInspectionFailureMessage', () => {
	it('names the branch when it does not exist', () => {
		expect(
			getInspectionFailureMessage({ branch: 'feat/x', inspection_error_code: 'branch_not_found' })
		).toContain('feat/x');
	});

	it('says a GitHub rate limit is not about the repository', () => {
		expect(
			getInspectionFailureMessage({ branch: 'main', inspection_error_code: 'github_rate_limited' })
		).toContain('bukan masalah di repository');
	});

	it.each([null, 'runtime_something_new'])('falls back honestly for %s', (code) => {
		expect(getInspectionFailureMessage({ branch: 'main', inspection_error_code: code })).toContain(
			'belum diketahui'
		);
	});
});

describe('getPortDescription', () => {
	const port = (configured: number | null, detected: number | null, effective: number) =>
		getPortDescription({
			configured_port: configured,
			detected_port: detected,
			effective_port: effective
		} as Pick<Project, 'configured_port' | 'detected_port' | 'effective_port'>);

	it('says where the number came from', () => {
		expect(port(8080, null, 8080)).toBe('8080 (kamu yang mengisi)');
		expect(port(null, 5000, 5000)).toBe('5000 (terdeteksi)');
		expect(port(null, null, 3000)).toBe('3000 (bawaan)');
	});
});

describe('inspection notes', () => {
	it('mentions only what the agent found', () => {
		expect(getInspectionNotes({ inspection })).toEqual([]);
		expect(
			getInspectionNotes({
				inspection: { ...inspection, env_example_found: true, compose_found: true }
			})
		).toHaveLength(2);
		expect(getInspectionNotes({ inspection: null })).toEqual([]);
	});

	it('lists the manifests it found', () => {
		expect(getInspectedFiles({ inspection })).toEqual(['package.json']);
	});
});

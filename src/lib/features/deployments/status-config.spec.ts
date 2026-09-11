import { describe, it, expect } from 'vitest';
import {
	getStatusDisplay,
	getTimelineItemDisplay,
	getTimeLabel,
	deriveBannerState
} from './status-config';
import type { DeploymentProgress } from './type';

describe('getStatusDisplay', () => {
	it('show running status message with currentStepLabel', () => {
		const result = getStatusDisplay({ status: 'running', currentStepLabel: 'Building image' });

		expect(result.title).toBe('Deployment sedang berjalan');
		expect(result.desc).toBe('Tahap: Building image, perkiraan selesai dalam beberapa detik');
		expect(result.bannerBgClass).toBe('bg-warning/10');
		expect(result.iconColorClass).toBe('bg-warning-dark text-white');
	});

	it('fallback to "-" when currentStepLabel is not provided', () => {
		const result = getStatusDisplay({ status: 'running' });

		expect(result.desc).toContain('Tahap: -,');
	});

	it('show success status message with durationLabel', () => {
		const result = getStatusDisplay({ status: 'success', durationLabel: '48 detik' });

		expect(result.title).toBe('Deployment berhasil');
		expect(result.desc).toBe('Selesai dalam 48 detik, perubahan sudah live');
		expect(result.bannerBgClass).toBe('bg-success-soft');
		expect(result.iconColorClass).toBeUndefined();
	});

	it('show failed status message with failedStepLabel', () => {
		const result = getStatusDisplay({ status: 'failed', failedStepLabel: 'Building image' });

		expect(result.title).toBe('Deployment gagal');
		expect(result.desc).toBe(
			'Berhenti di tahap Building image, lihat log di bawah untuk detail error'
		);
		expect(result.bannerBgClass).toBe('bg-error/10');
	});
});

describe('getTimelineItemDisplay', () => {
	it('pending status: only title, without subtitle', () => {
		const result = getTimelineItemDisplay({ status: 'pending', title: 'Deploy container' });

		expect(result.title).toBe('Deploy container');
		expect(result.subtitle).toBeUndefined();
	});

	it('running status: subtitle "Sedang berjalan..."', () => {
		const result = getTimelineItemDisplay({ status: 'running', title: 'Building image' });

		expect(result.title).toBe('Building image');
		expect(result.subtitle).toBe('Sedang berjalan...');
	});

	it('success status: subtitle timestamp', () => {
		const result = getTimelineItemDisplay({
			status: 'success',
			title: 'Cloning repository',
			timestamp: '08:41:02'
		});

		expect(result.title).toBe('Cloning repository');
		expect(result.subtitle).toBe('08:41:02');
	});

	it('failed status: title got suffix "- gagal" and subtitle timestamp', () => {
		const result = getTimelineItemDisplay({
			status: 'failed',
			title: 'Building image',
			timestamp: '08:39:12'
		});

		expect(result.title).toBe('Building image - gagal');
		expect(result.subtitle).toBe('08:39:12');
	});
});

describe('getTimelineItemDisplay - showSubtitle: false', () => {
	it('running: tidak ada subtitle', () => {
		const result = getTimelineItemDisplay({
			status: 'running',
			title: 'Building image',
			showSubtitle: false
		});

		expect(result.title).toBe('Building image');
		expect(result.subtitle).toBeUndefined();
	});

	it('success: tidak ada subtitle walau timestamp diberikan', () => {
		const result = getTimelineItemDisplay({
			status: 'success',
			title: 'Cloning repository',
			timestamp: '08:41:02',
			showSubtitle: false
		});

		expect(result.title).toBe('Cloning repository');
		expect(result.subtitle).toBeUndefined();
	});

	it('failed: tidak ada subtitle, tapi suffix "- gagal" tetap ada di title', () => {
		const result = getTimelineItemDisplay({
			status: 'failed',
			title: 'Building image',
			timestamp: '08:39:12',
			showSubtitle: false
		});

		expect(result.title).toBe('Building image - gagal');
		expect(result.subtitle).toBeUndefined();
	});

	it('pending: showSubtitle false tidak mengubah apa pun (memang sudah tanpa subtitle by default)', () => {
		const result = getTimelineItemDisplay({
			status: 'pending',
			title: 'Deploy container',
			showSubtitle: false
		});

		expect(result.title).toBe('Deploy container');
		expect(result.subtitle).toBeUndefined();
	});
});

describe('getTimeLabel', () => {
	it.each([
		['running', 'Dimulai pada'],
		['success', 'Selesai pada'],
		['failed', 'Gagal pada']
	] as const)('status %s -> "%s"', (status, expected) => {
		expect(getTimeLabel(status)).toBe(expected);
	});
});

describe('deriveBannerState', () => {
	it('failed when errorMessage exists', () => {
		const progress: DeploymentProgress = {
			steps: [
				{ key: 'clone', title: 'Cloning repository', status: 'success' },
				{ key: 'build', title: 'Building image', status: 'failed', timestamp: '08:41:15' }
			],
			logs: [],
			errorMessage: 'Build failed with exit code 1'
		};

		const result = deriveBannerState(progress, 13);

		expect(result.status).toBe('failed');
		expect(result.failedStepLabel).toBe('Building image');
	});

	it('success when all steps success', () => {
		const progress: DeploymentProgress = {
			steps: [
				{ key: 'clone', title: 'Cloning repository', status: 'success' },
				{ key: 'build', title: 'Building image', status: 'success' }
			],
			logs: []
		};

		const result = deriveBannerState(progress, 28);

		expect(result.status).toBe('success');
		expect(result.durationLabel).toBe('28 detik');
	});

	it('running when a step is currently running', () => {
		const progress: DeploymentProgress = {
			steps: [
				{ key: 'clone', title: 'Cloning repository', status: 'success' },
				{ key: 'build', title: 'Building image', status: 'running' },
				{ key: 'deploy', title: 'Deploy container', status: 'pending' }
			],
			logs: []
		};

		const result = deriveBannerState(progress, 10);

		expect(result.status).toBe('running');
		expect(result.currentStepLabel).toBe('Building image');
	});

	it('edge case: all steps still pending, status stays running without currentStepLabel', () => {
		const progress: DeploymentProgress = {
			steps: [
				{ key: 'clone', title: 'Cloning repository', status: 'pending' },
				{ key: 'build', title: 'Building image', status: 'pending' }
			],
			logs: []
		};

		const result = deriveBannerState(progress, 0);

		expect(result.status).toBe('running');
		expect(result.currentStepLabel).toBeUndefined();
	});
});

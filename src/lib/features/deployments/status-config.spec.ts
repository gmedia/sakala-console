import { describe, it, expect } from 'vitest';
import {
	isBannerStatus,
	getBannerStatus,
	getDeploymentStageLabel,
	getBannerStatusFromDeploymentStatus,
	getStatusDisplay,
	getTimelineItemDisplay,
	getTimeLabel,
	deriveBannerState,
	parseBannerStatus,
	deriveLiveInfoTimestamp
} from './status-config';
import type { DeploymentProgress } from './type';

describe('isBannerStatus', () => {
	it('returns true for supported statuses', () => {
		expect(isBannerStatus('running')).toBe(true);
		expect(isBannerStatus('success')).toBe(true);
		expect(isBannerStatus('failed')).toBe(true);
	});

	it('returns false for unsupported statuses and null', () => {
		expect(isBannerStatus('pending')).toBe(false);
		expect(isBannerStatus('foo')).toBe(false);
		expect(isBannerStatus(null)).toBe(false);
	});
});

describe('getDeploymentStageLabel', () => {
	it.each([
		['Queued', 'Menunggu antrean'],
		['Cloning', 'Menyalin repository'],
		['Analyzing', 'Menganalisis project'],
		['Building', 'Build project'],
		['Deploying', 'Deploy project'],
		['Routing', 'Menyiapkan routing'],
		['HealthChecking', 'Memeriksa kesehatan aplikasi'],
		['Succeeded', 'Selesai'],
		['Failed', 'Gagal'],
		['Cancelled', 'Dibatalkan']
	] as const)('maps %s -> %s', (stage, expected) => {
		expect(getDeploymentStageLabel(stage)).toBe(expected);
	});
});

describe('getBannerStatusFromDeploymentStatus', () => {
	it('maps succeeded -> success', () => {
		expect(getBannerStatusFromDeploymentStatus('succeeded')).toBe('success');
	});

	it.each(['failed', 'cancelled'])('maps %s -> failed', (status) => {
		expect(getBannerStatusFromDeploymentStatus(status)).toBe('failed');
	});

	it.each(['running', 'queued', 'pending', 'unknown'])(
		'maps %s -> running (fallback)',
		(status) => {
			expect(getBannerStatusFromDeploymentStatus(status)).toBe('running');
		}
	);
});

describe('getBannerStatus', () => {
	it.each([
		['Queued', 'running'],
		['Cloning', 'running'],
		['Analyzing', 'running'],
		['Building', 'running'],
		['Deploying', 'running'],
		['Routing', 'running'],
		['HealthChecking', 'running'],
		['Succeeded', 'success'],
		['Failed', 'failed'],
		['Cancelled', 'failed']
	] as const)('maps %s -> %s', (stage, expected) => {
		expect(getBannerStatus(stage)).toBe(expected);
	});
});

describe('getStatusDisplay', () => {
	it('show running status message with currentStepLabel', () => {
		const result = getStatusDisplay({ status: 'running', currentStepLabel: 'Building image' });

		expect(result.title).toBe('Deployment sedang berjalan');
		expect(result.desc).toBe(
			'Tahap: Building image. Kamu dapat meninggalkan halaman ini dan kembali lagi nanti untuk melihat progresnya.'
		);
		expect(result.bannerBgClass).toBe('bg-warning/10');
		expect(result.iconColorClass).toBe('bg-warning-dark text-white');
	});

	it('fallback to "-" when currentStepLabel is not provided', () => {
		const result = getStatusDisplay({ status: 'running' });

		expect(result.desc).toContain('Tahap: -.');
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
	it('returns failed when stage is Failed', () => {
		const progress: DeploymentProgress = {
			stage: 'Failed',
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

	it('returns failed when stage is Cancelled', () => {
		const progress: DeploymentProgress = {
			stage: 'Cancelled',
			steps: [{ key: 'build', title: 'Building image', status: 'failed', timestamp: '08:41:15' }],
			logs: []
		};

		const result = deriveBannerState(progress, 10);

		expect(result.status).toBe('failed');
		expect(result.failedStepLabel).toBe('Building image');
	});

	it('returns success when stage is Succeeded', () => {
		const progress: DeploymentProgress = {
			stage: 'Succeeded',
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

	it.each([
		['Queued', 'Menunggu antrean'],
		['Cloning', 'Menyalin repository'],
		['Analyzing', 'Menganalisis project'],
		['Building', 'Build project'],
		['Deploying', 'Deploy project'],
		['Routing', 'Menyiapkan routing'],
		['HealthChecking', 'Memeriksa kesehatan aplikasi']
	] as const)('returns running for stage %s', (stage, expectedLabel) => {
		const progress: DeploymentProgress = {
			stage,
			steps: [],
			logs: []
		};

		const result = deriveBannerState(progress, 10);

		expect(result.status).toBe('running');
		expect(result.currentStepLabel).toBe(expectedLabel);
	});

	it('uses failed step label when stage is Failed', () => {
		const progress: DeploymentProgress = {
			stage: 'Failed',
			steps: [
				{ key: 'clone', title: 'Cloning repository', status: 'success' },
				{ key: 'build', title: 'Building image', status: 'failed' },
				{ key: 'deploy', title: 'Deploy container', status: 'pending' }
			],
			logs: []
		};

		const result = deriveBannerState(progress, 10);

		expect(result.status).toBe('failed');
		expect(result.failedStepLabel).toBe('Building image');
	});

	it('returns failed without failedStepLabel when no step is marked failed', () => {
		const progress: DeploymentProgress = {
			stage: 'Failed',
			steps: [
				{ key: 'clone', title: 'Cloning repository', status: 'success' },
				{ key: 'build', title: 'Building image', status: 'running' }
			],
			logs: []
		};

		const result = deriveBannerState(progress, 10);

		expect(result.status).toBe('failed');
		expect(result.failedStepLabel).toBeUndefined();
	});

	it('uses stage as the source of truth instead of step statuses', () => {
		const progress: DeploymentProgress = {
			stage: 'Building',
			steps: [
				{ key: 'clone', title: 'Cloning repository', status: 'success' },
				{ key: 'build', title: 'Building image', status: 'success' }
			],
			logs: []
		};

		const result = deriveBannerState(progress, 10);

		expect(result.status).toBe('running');
		expect(result.currentStepLabel).toBe('Build project');
	});
});

describe('parseBannerStatus', () => {
	it('accepts valid banner statuses', () => {
		expect(parseBannerStatus('running')).toBe('running');
		expect(parseBannerStatus('success')).toBe('success');
		expect(parseBannerStatus('failed')).toBe('failed');
	});

	it('fallbacks to running when given invalid status', () => {
		expect(parseBannerStatus('foo')).toBe('running');
		expect(parseBannerStatus('pending')).toBe('running');
		expect(parseBannerStatus(null)).toBe('running');
	});

	it('allows custom fallback', () => {
		expect(parseBannerStatus('foo', 'failed')).toBe('failed');
	});
});

describe('deriveLiveInfoTimestamp', () => {
	it('running: pakai startedAtLabel', () => {
		const result = deriveLiveInfoTimestamp({
			status: 'running',
			startedAtLabel: '08:41:00'
		});
		expect(result).toBe('08:41:00');
	});

	it('running: abaikan finishedAtLabel walau disediakan', () => {
		const result = deriveLiveInfoTimestamp({
			status: 'running',
			startedAtLabel: '08:41:00',
			finishedAtLabel: '08:41:49'
		});
		expect(result).toBe('08:41:00');
	});

	it('success: pakai finishedAtLabel', () => {
		const result = deriveLiveInfoTimestamp({
			status: 'success',
			startedAtLabel: '08:41:00',
			finishedAtLabel: '08:41:49'
		});
		expect(result).toBe('08:41:49');
	});

	it('success: return "-" jika finishedAtLabel undefined', () => {
		const result = deriveLiveInfoTimestamp({
			status: 'success',
			startedAtLabel: '08:41:00'
		});
		expect(result).toBe('-');
	});

	it('failed: pakai finishedAtLabel', () => {
		const result = deriveLiveInfoTimestamp({
			status: 'failed',
			startedAtLabel: '08:41:00',
			finishedAtLabel: '08:39:12'
		});
		expect(result).toBe('08:39:12');
	});

	it('failed: return "-" jika finishedAtLabel undefined', () => {
		const result = deriveLiveInfoTimestamp({
			status: 'failed',
			startedAtLabel: '08:41:00'
		});
		expect(result).toBe('-');
	});
});

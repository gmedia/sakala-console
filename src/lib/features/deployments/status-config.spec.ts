import { describe, it, expect } from 'vitest';
import {
	isBannerStatus,
	getBannerStatus,
	getDeploymentStageLabel,
	getBannerStatusFromDeploymentStatus,
	getDeploymentStatusLabel,
	getRecoveryHintLabel,
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
		['Building', 'Build proyek'],
		['Deploying', 'Deploy proyek'],
		['Routing', 'Menyiapkan routing'],
		['Succeeded', 'Berhasil'],
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

	it('maps failed -> failed', () => {
		expect(getBannerStatusFromDeploymentStatus('failed')).toBe('failed');
	});

	it('keeps cancelled apart from failed', () => {
		expect(getBannerStatusFromDeploymentStatus('cancelled')).toBe('cancelled');
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
		['Building', 'running'],
		['Deploying', 'running'],
		['Routing', 'running'],
		['Succeeded', 'success'],
		['Failed', 'failed'],
		['Cancelled', 'cancelled']
	] as const)('maps %s -> %s', (stage, expected) => {
		expect(getBannerStatus(stage)).toBe(expected);
	});
});

describe('getStatusDisplay', () => {
	it('show running status message with currentStepLabel', () => {
		const result = getStatusDisplay({ status: 'running', currentStepLabel: 'Building image' });

		expect(result.title).toBe('Deployment sedang berjalan');
		expect(result.desc).toBe(
			'Tahap: Building image. Kamu boleh meninggalkan halaman ini dan kembali lagi nanti.'
		);
		expect(result.bannerBgClass).toBe('bg-primary-50');
		expect(result.iconColorClass).toBe('bg-primary text-white');
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

	it.each([
		['checkout', 'Deployment gagal saat mengambil source code'],
		['build', 'Deployment gagal saat build'],
		['start', 'Deployment gagal saat menjalankan aplikasi'],
		['health', 'Deployment gagal saat pengecekan aplikasi'],
		['route', 'Deployment gagal saat menyiapkan alamat publik'],
		['timeout', 'Deployment melewati batas waktu'],
		['resource', 'Deployment gagal karena batas resource'],
		['node', 'Deployment gagal karena server Sakala belum siap'],
		['scheduling', 'Deployment gagal karena belum ada server yang tersedia']
	])('names the failure category %s in the headline', (failureCategory, title) => {
		expect(getStatusDisplay({ status: 'failed', failureCategory }).title).toBe(title);
	});

	it.each(['unknown', 'kategori_baru_dari_api', undefined])(
		'stays honest for the unrecognised category %s and points at the logs',
		(failureCategory) => {
			const result = getStatusDisplay({ status: 'failed', failureCategory });

			expect(result.title).toBe('Deployment gagal');
			expect(result.desc).toBe('Penyebabnya belum bisa dipastikan. Lihat log untuk detailnya.');
		}
	);

	it('does not diagnose from the summary text', () => {
		const result = getStatusDisplay({
			status: 'failed',
			failureCategory: 'unknown',
			failureSummary: 'Build failed: out of memory and timeout'
		});

		expect(result.title).toBe('Deployment gagal');
	});

	it('show failed status message with failedStepLabel', () => {
		const result = getStatusDisplay({ status: 'failed', failedStepLabel: 'Building image' });

		expect(result.title).toBe('Deployment gagal');
		expect(result.desc).toBe('Berhenti di tahap Building image. Lihat log untuk detail error.');
		expect(result.bannerBgClass).toBe('bg-error/10');
	});
});

describe('getStatusDisplay - contract fields', () => {
	it('never says "sudah live" for a deployment that is not the active one', () => {
		const superseded = getStatusDisplay({
			status: 'success',
			durationLabel: '48 detik',
			servingState: 'superseded'
		});

		expect(superseded.desc).toContain('digantikan');
		expect(superseded.desc).not.toContain('live');
		expect(
			getStatusDisplay({
				status: 'success',
				durationLabel: '48 detik',
				servingState: 'not_serving'
			}).desc
		).not.toContain('live');
		expect(
			getStatusDisplay({ status: 'success', durationLabel: '48 detik', servingState: 'live' }).desc
		).toContain('sudah live');
	});

	it('claims neither live nor replaced while is_active is not known yet', () => {
		const { desc } = getStatusDisplay({
			status: 'success',
			durationLabel: '48 detik',
			servingState: 'unconfirmed'
		});

		expect(desc).toContain('Selesai dalam 48 detik');
		expect(desc).not.toContain('digantikan');
		expect(desc).not.toContain('live');
	});

	it('does not call a cancelled deployment a failure', () => {
		const display = getStatusDisplay({ status: 'cancelled' });

		expect(display.title).toBe('Deployment dibatalkan');
		expect(`${display.title} ${display.desc}`).not.toMatch(/gagal/i);
	});

	it('marks a queue in orange, because running is healthy and waiting may need a look', () => {
		const result = getStatusDisplay({ status: 'running', queueState: 'waiting_for_node' });

		expect(result.bannerBgClass).toBe('bg-queued-soft');
		expect(result.iconColorClass).toBe('bg-queued text-white');
	});

	it('a queue that is being cancelled is not shown as waiting', () => {
		const result = getStatusDisplay({
			status: 'running',
			queueState: 'waiting_for_node',
			cancelRequested: true
		});

		expect(result.bannerBgClass).toBe('bg-primary-50');
	});

	it('explains waiting for a node without inventing a time', () => {
		const display = getStatusDisplay({ status: 'running', queueState: 'waiting_for_node' });

		expect(display.title).toBe('Deployment mengantre');
		expect(display.desc).toContain('Belum ada server Sakala yang siap');
		expect(display.desc).not.toMatch(/\d|perkiraan|sebentar/i);
	});

	it('says a cancel is on its way rather than still running', () => {
		expect(getStatusDisplay({ status: 'running', cancelRequested: true }).title).toBe(
			'Deployment sedang dibatalkan'
		);
	});

	it('reads user_fixable false as a platform problem, without blaming the code', () => {
		const display = getStatusDisplay({
			status: 'failed',
			failureCategory: 'node',
			failedStepLabel: 'Build proyek',
			userFixable: false
		});

		expect(display.desc).toContain('kendala di sisi platform Sakala');
		expect(display.desc).toContain('Build proyek');
	});

	it('does not claim the platform for an unknown failure', () => {
		const display = getStatusDisplay({
			status: 'failed',
			failureCategory: 'unknown',
			userFixable: false
		});

		expect(display.desc).not.toContain('platform');
		expect(display.desc).toContain('belum bisa dipastikan');
	});

	it('labels the hint by who can act on it', () => {
		expect(getRecoveryHintLabel(true)).toBe('Cara memperbaiki:');
		expect(getRecoveryHintLabel(false)).toBe('Yang bisa kamu lakukan:');
	});

	it('names the stages the API sends', () => {
		expect(getDeploymentStatusLabel('health_checking')).toBe('Mengecek aplikasi');
		expect(getDeploymentStatusLabel('analyzing')).toBe('Menganalisis proyek');
	});
});

describe('getTimelineItemDisplay', () => {
	it('cancelled status: title says dibatalkan, not gagal', () => {
		expect(getTimelineItemDisplay({ status: 'cancelled', title: 'Build proyek' }).title).toBe(
			'Build proyek - dibatalkan'
		);
	});

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

	it('returns cancelled when stage is Cancelled', () => {
		const progress: DeploymentProgress = {
			stage: 'Cancelled',
			steps: [{ key: 'build', title: 'Building image', status: 'failed', timestamp: '08:41:15' }],
			logs: []
		};

		expect(deriveBannerState(progress, 10)).toEqual({ status: 'cancelled' });
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
		['Building', 'Build proyek'],
		['Deploying', 'Deploy proyek'],
		['Routing', 'Menyiapkan routing']
	] as const)('returns running for stage %s', (stage, expectedLabel) => {
		const progress: DeploymentProgress = { stage, steps: [], logs: [] };
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
		expect(result.currentStepLabel).toBe('Build proyek');
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

describe('states a deployment can end up in', () => {
	it('says the cause once, in the words of the API, when it sent one', () => {
		const result = getStatusDisplay({
			status: 'failed',
			failureCategory: 'build',
			failedStepLabel: 'Build proyek',
			failureSummary: 'Proses build aplikasi berhenti sebelum selesai.',
			userFixable: true
		});

		expect(result.title).toBe('Deployment gagal saat build');
		expect(result.desc).toBe('Proses build aplikasi berhenti sebelum selesai.');
	});

	it('does not put a platform failure on the code of the user', () => {
		const result = getStatusDisplay({
			status: 'failed',
			failureCategory: 'node',
			failureSummary: 'Server Sakala berhenti saat deployment berjalan.',
			userFixable: false
		});

		expect(result.desc).toBe(
			'Server Sakala berhenti saat deployment berjalan. Ini kendala di sisi platform Sakala, bukan dari kode kamu.'
		);
	});

	it.each([
		['crash_looping', 'Deployment berhasil, tapi aplikasinya terus crash'],
		['not_serving', 'Deployment berhasil, tapi aplikasinya tidak melayani']
	] as const)('does not call %s a plain success', (servingState, title) => {
		const result = getStatusDisplay({ status: 'success', durationLabel: '1 menit', servingState });

		expect(result.title).toBe(title);
		expect(result.iconColorClass).toContain('bg-warning');
		expect(result.desc).not.toContain('bagian atas halaman');
	});

	it('never promises how long it will take or how far along it is', () => {
		const texts = (
			[
				{ status: 'running', currentStepLabel: 'Build proyek' },
				{ status: 'running', queueState: 'waiting_for_node' },
				{ status: 'running', queueState: 'assigned' },
				{ status: 'running', cancelRequested: true }
			] as const
		).map((input) => getStatusDisplay(input).desc);

		for (const text of texts) expect(text).not.toMatch(/%|\bsekitar\b|\bperkiraan\b|\bETA\b/i);
	});
});

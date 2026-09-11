import { describe, it, expect } from 'vitest';
import { getStatusDisplay, getTimelineItemDisplay, getTimeLabel } from './status-config';

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
		expect(result.bannerBgClass).toBe('bg-primary/10');
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

describe('getTimeLabel', () => {
	it.each([
		['running', 'Dimulai pada'],
		['success', 'Selesai pada'],
		['failed', 'Gagal pada']
	] as const)('status %s -> "%s"', (status, expected) => {
		expect(getTimeLabel(status)).toBe(expected);
	});
});

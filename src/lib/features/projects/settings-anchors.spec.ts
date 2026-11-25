import { describe, expect, it } from 'vitest';
import { settingsSections } from './settings-anchors';

const labels = (features: { workers: boolean; schedules: boolean; domains?: boolean }) =>
	settingsSections(features).map((section) => section.label);

describe('settingsSections', () => {
	it('lists Proses and Jadwal only where the installation has them on', () => {
		expect(labels({ workers: false, schedules: false })).toEqual([
			'Umum',
			'Build dan start',
			'Lanjutan',
			'Zona berbahaya'
		]);
		expect(labels({ workers: true, schedules: false })).toContain('Proses');
		expect(labels({ workers: true, schedules: false })).not.toContain('Jadwal');
		expect(labels({ workers: true, schedules: true })).toEqual([
			'Umum',
			'Build dan start',
			'Lanjutan',
			'Proses',
			'Jadwal',
			'Zona berbahaya'
		]);
	});

	it('lists Domain only where custom domains are on, after Lanjutan', () => {
		expect(labels({ workers: false, schedules: false, domains: false })).not.toContain('Domain');
		expect(labels({ workers: true, schedules: true, domains: true })).toEqual([
			'Umum',
			'Build dan start',
			'Lanjutan',
			'Domain',
			'Proses',
			'Jadwal',
			'Zona berbahaya'
		]);
	});
});

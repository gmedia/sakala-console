import { describe, expect, it } from 'vitest';
import { settingsSections } from './settings-anchors';

const labels = (features: { workers: boolean; schedules: boolean }) =>
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
});

import { describe, expect, it } from 'vitest';
import {
	dirtySettingsPages,
	SETTINGS_PAGES,
	settingsSections,
	settingsTarget
} from './settings-anchors';

const labels = (features: { workers: boolean; schedules: boolean; domains?: boolean }) =>
	settingsSections(features).map((section) => section.label);

describe('settingsSections', () => {
	it('lists Proses and Jadwal only where the installation has them on', () => {
		expect(labels({ workers: false, schedules: false })).toEqual([
			'Umum',
			'Build dan start',
			'Zona berbahaya'
		]);
		expect(labels({ workers: true, schedules: false })).toContain('Proses');
		expect(labels({ workers: true, schedules: false })).not.toContain('Jadwal');
		expect(labels({ workers: true, schedules: true })).toEqual([
			'Umum',
			'Build dan start',
			'Proses',
			'Jadwal',
			'Zona berbahaya'
		]);
	});

	it('lists Domain only where custom domains are on, after Build dan start', () => {
		expect(labels({ workers: false, schedules: false, domains: false })).not.toContain('Domain');
		expect(labels({ workers: true, schedules: true, domains: true })).toEqual([
			'Umum',
			'Build dan start',
			'Domain',
			'Proses',
			'Jadwal',
			'Zona berbahaya'
		]);
	});
});

describe('settingsTarget', () => {
	it('sends a link from before the split to the page that holds its section', () => {
		expect(settingsTarget('jadwal')).toEqual({ page: SETTINGS_PAGES.schedules, anchor: null });
		expect(settingsTarget('domain')).toEqual({ page: SETTINGS_PAGES.domains, anchor: null });
		expect(settingsTarget('proses')).toEqual({ page: SETTINGS_PAGES.processes, anchor: null });
		expect(settingsTarget('zona-berbahaya')).toEqual({ page: SETTINGS_PAGES.danger, anchor: null });
		expect(settingsTarget('umum')).toEqual({ page: SETTINGS_PAGES.general, anchor: null });
	});

	it('keeps a field anchor, so its page can open and scroll to it', () => {
		expect(settingsTarget('releaseCommand')).toEqual({
			page: SETTINGS_PAGES.build,
			anchor: 'releaseCommand'
		});
		expect(settingsTarget('replicas')).toEqual({ page: SETTINGS_PAGES.build, anchor: 'replicas' });
		expect(settingsTarget('lanjutan')).toEqual({ page: SETTINGS_PAGES.build, anchor: 'lanjutan' });
		expect(settingsTarget('auto-deploy')).toEqual({
			page: SETTINGS_PAGES.general,
			anchor: 'auto-deploy'
		});
	});

	it('opens Umum without an anchor, or with one it does not know', () => {
		expect(settingsTarget()).toEqual({ page: SETTINGS_PAGES.general, anchor: null });
		expect(settingsTarget('entah')).toEqual({ page: SETTINGS_PAGES.general, anchor: 'entah' });
	});
});

describe('dirtySettingsPages', () => {
	it('puts name, branch, and auto-deploy on Umum, and every other field on Build dan start', () => {
		expect([...dirtySettingsPages(['name', 'auto_deploy'])]).toEqual([SETTINGS_PAGES.general]);
		expect([...dirtySettingsPages(['configured_port', 'replicas'])]).toEqual([
			SETTINGS_PAGES.build
		]);
		expect(dirtySettingsPages(['branch', 'release_command']).size).toBe(2);
		expect(dirtySettingsPages([]).size).toBe(0);
	});
});

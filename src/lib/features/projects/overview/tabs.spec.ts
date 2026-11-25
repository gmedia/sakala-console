import { describe, expect, it } from 'vitest';
import { activeProjectTab, PROJECT_TAB_LABELS, PROJECT_TABS } from './tabs';

const ID = '01a0cd45';

describe('project tabs', () => {
	it('puts Ringkasan first', () => {
		expect(PROJECT_TABS.map((tab) => PROJECT_TAB_LABELS[tab])).toEqual([
			'Ringkasan',
			'Riwayat',
			'Metrik',
			'Variabel',
			'Pengaturan'
		]);
	});

	it('marks the overview only on the project address itself', () => {
		expect(activeProjectTab(`/projects/${ID}`, ID)).toBe('overview');
		expect(activeProjectTab(`/projects/${ID}/`, ID)).toBe('overview');
		expect(activeProjectTab(`/projects/${ID}/settings`, ID)).toBe('settings');
		// Every settings sub-page keeps the Pengaturan tab marked.
		expect(activeProjectTab(`/projects/${ID}/settings/build`, ID)).toBe('settings');
	});

	it('keeps Riwayat marked on a deployment page', () => {
		expect(activeProjectTab(`/projects/${ID}/deployments`, ID)).toBe('deployments');
		expect(activeProjectTab(`/projects/${ID}/deployments/dep-1`, ID)).toBe('deployments');
	});

	it('does not match a word inside another segment or another project', () => {
		expect(activeProjectTab(`/projects/${ID}/monitoring-old`, ID)).toBeNull();
		expect(activeProjectTab(`/projects/other/settings`, ID)).toBeNull();
		expect(activeProjectTab(`/projects/${ID}/overview`, ID)).toBeNull();
	});
});

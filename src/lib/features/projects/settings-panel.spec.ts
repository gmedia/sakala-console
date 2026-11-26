import { describe, expect, it } from 'vitest';
import { LARAVEL_QUEUE_WORKER } from '$lib/features/workloads/processes';
import { LARAVEL_SCHEDULER } from '$lib/features/workloads/schedules';
import { MAX_PANEL_STEPS as MAX_NEXT_STEPS } from '$lib/components/panel/panel';
import {
	deriveSettingsSteps,
	hiddenSettingsStepCount,
	type SettingsStepContext
} from './settings-panel';
import { SETTINGS_ANCHORS, SETTINGS_SECTION_IDS } from './settings-anchors';

const laravel = {
	status: 'active',
	branch: 'main',
	repository_source: 'github_installation',
	auto_deploy: true,
	release_command: null,
	stack: { framework: 'Laravel' },
	inspection: null,
	replicas: 1,
	max_replicas: 1
} as unknown as Parameters<typeof deriveSettingsSteps>[0];

const node = { ...laravel, stack: { framework: 'express' } } as typeof laravel;

const allOn: SettingsStepContext = {
	readOnly: false,
	domains: [],
	domainQuota: { max: 1, current: 0, full: false },
	processes: [],
	schedules: []
};

const ids = (project: typeof laravel, context: SettingsStepContext) =>
	deriveSettingsSteps(project, context).map((step) => step.id);

describe('the settings panel next steps', () => {
	it('suggests at most three, the most useful first', () => {
		const steps = deriveSettingsSteps(laravel, allOn);
		expect(steps).toHaveLength(MAX_NEXT_STEPS);
		expect(steps).toEqual([
			{
				id: 'release-command',
				label: 'Atur release command',
				anchor: SETTINGS_ANCHORS.releaseCommand
			},
			{ id: 'domain', label: 'Pasang custom domain', anchor: SETTINGS_SECTION_IDS.domains },
			{ id: 'worker', label: 'Tambah worker antrean', anchor: SETTINGS_SECTION_IDS.processes }
		]);
	});

	it('offers only what applies: nothing Laravel for another framework', () => {
		expect(ids(node, allOn)).toEqual(['domain']);
	});

	it('drops a step once it is done', () => {
		const done: SettingsStepContext = {
			...allOn,
			domains: [{ status: 'active' }],
			processes: [LARAVEL_QUEUE_WORKER],
			schedules: [{ command: LARAVEL_SCHEDULER.command }]
		};
		expect(ids({ ...laravel, release_command: 'php artisan migrate --force' }, done)).toEqual([]);
	});

	it('treats a released domain as none, and a full or missing quota as no room', () => {
		expect(ids(node, { ...allOn, domains: [{ status: 'released' }] })).toEqual(['domain']);
		expect(ids(node, { ...allOn, domainQuota: { max: 1, current: 1, full: true } })).toEqual([]);
		expect(ids(node, { ...allOn, domainQuota: null })).toEqual([]);
	});

	it('says nothing about a feature that is off or still loading', () => {
		expect(ids(laravel, { readOnly: false })).toEqual(['release-command']);
	});

	it('includes the overview rules for auto-deploy and replicas', () => {
		const project = { ...node, auto_deploy: false, max_replicas: 3 } as typeof laravel;
		expect(ids(project, { readOnly: false })).toEqual(['auto-deploy', 'replicas']);
	});

	it('respects a suggestion hidden on the overview', () => {
		expect(ids(laravel, { ...allOn, dismissed: new Set(['release-command']) })).toEqual([
			'domain',
			'worker',
			'schedule'
		]);
	});

	it('counts hidden steps that still apply, and lets the next one take the free place', () => {
		const context = { ...allOn, dismissed: new Set(['release-command', 'auto-deploy']) };
		// auto-deploy does not apply to this project, so only one hidden step counts.
		expect(hiddenSettingsStepCount(laravel, context)).toBe(1);
		expect(ids(laravel, context)).toEqual(['domain', 'worker', 'schedule']);
		expect(hiddenSettingsStepCount(laravel, allOn)).toBe(0);
	});

	it('gives a viewer and a suspended project nothing', () => {
		expect(ids(laravel, { ...allOn, readOnly: true })).toEqual([]);
		expect(ids({ ...laravel, status: 'suspended' } as typeof laravel, allOn)).toEqual([]);
	});
});

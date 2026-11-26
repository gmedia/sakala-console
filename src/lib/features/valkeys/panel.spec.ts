import { describe, expect, it } from 'vitest';
import { parseValkey } from '$lib/api/resources/valkeys';
import { getValkeyFixture } from '$lib/testing/valkey-fixtures';
import { deriveValkeySteps, VALKEY_ANCHORS } from './panel';

/** A captured store: persistent, 64 MB, 18 MB used, attached to one project. */
const queue = () => parseValkey(getValkeyFixture('valkey-show').body);
const MB = 1024 * 1024;

describe('the Valkey panel next steps', () => {
	it('suggests nothing for a healthy store already in use', () => {
		expect(deriveValkeySteps(queue(), true)).toEqual([]);
	});

	it('suggests attaching a store no project uses', () => {
		const steps = deriveValkeySteps({ ...queue(), projects: [] }, true);
		expect(steps).toEqual([
			{ id: 'attach', label: 'Pasang ke proyek', href: `#${VALKEY_ANCHORS.projects}` }
		]);
	});

	it('suggests a bigger size once the memory warning shows', () => {
		const valkey = queue();
		const nearlyFull = { ...valkey, usage: { ...valkey.usage, used_memory_bytes: 60 * MB } };
		expect(deriveValkeySteps(nearlyFull, true).map((step) => step.id)).toEqual(['resize']);
	});

	it('gives a viewer and a store that is not ready nothing', () => {
		const idle = { ...queue(), projects: [] };
		expect(deriveValkeySteps(idle, false)).toEqual([]);
		expect(deriveValkeySteps({ ...idle, status: 'provisioning' }, true)).toEqual([]);
		expect(deriveValkeySteps({ ...idle, status: 'locked' }, true)).toEqual([]);
	});
});

import { describe, expect, it } from 'vitest';
import { parsePilotLimitsResponse } from '$lib/api/resources/pilot-limits';
import { getWorkloadFixture } from '$lib/testing/workload-fixtures';
import { workloadFlags } from './availability.svelte';

describe('workloadFlags', () => {
	it('follows the pilot-limits flags, and reads off until they arrive', () => {
		const on = parsePilotLimitsResponse(getWorkloadFixture('pilot-limits-on').body);
		const off = parsePilotLimitsResponse(getWorkloadFixture('pilot-limits-off').body);
		expect(workloadFlags(on)).toEqual({ workers: true, schedules: true });
		expect(workloadFlags(off)).toEqual({ workers: false, schedules: false });
		expect(workloadFlags(undefined)).toEqual({ workers: false, schedules: false });
		// An API before ADR-022 sends neither field.
		expect(workloadFlags({ ...on, workers: undefined, schedules: undefined })).toEqual({
			workers: false,
			schedules: false
		});
	});
});

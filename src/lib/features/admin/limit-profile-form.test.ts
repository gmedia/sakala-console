import { describe, expect, it } from 'vitest';
import {
	emptyProfileValues,
	hasOptionalValue,
	invalidProfileLabels,
	PROFILE_GROUPS,
	PROFILE_NUMBER_FIELDS,
	profilePayload
} from './limit-profile-form';

describe('limit profile form', () => {
	it('puts every field in one of the three groups, the optional ones last', () => {
		expect(PROFILE_GROUPS.map((group) => group.title)).toEqual([
			'Kapasitas workspace',
			'Sumber daya per proyek',
			'Opsional'
		]);
		expect(
			PROFILE_NUMBER_FIELDS.filter((field) => field.group === 'optional').map((field) => field.key)
		).toEqual(['max_builds_per_hour', 'idle_sleep_minutes', 'max_replicas']);
		for (const field of PROFILE_NUMBER_FIELDS) {
			expect(Boolean(field.optional), field.key).toBe(field.group === 'optional');
		}
	});

	it('no longer says the API ignores Build per jam', () => {
		const builds = PROFILE_NUMBER_FIELDS.find((field) => field.key === 'max_builds_per_hour');
		expect(builds?.hint).not.toMatch(/belum menegakkan/);
		expect(builds?.hint).toMatch(/60 menit terakhir, termasuk yang gagal/);
	});

	it('names what is missing, the name first', () => {
		const values = { ...emptyProfileValues(), max_projects: '2' };
		expect(invalidProfileLabels('', values)).toEqual([
			'Nama',
			'Container berjalan',
			'Deployment berjalan',
			'Memori per proyek (MB)',
			'CPU per proyek (millicore)'
		]);
	});

	it('sends integers, null for an empty optional field, and 0 as a value', () => {
		const values = {
			...emptyProfileValues(),
			max_projects: 5,
			max_active_containers: '5',
			max_active_deployments: '2',
			max_memory_mb: '512',
			max_cpu_millis: '1000',
			idle_sleep_minutes: '0'
		};
		expect(hasOptionalValue(values)).toBe(true);
		expect(profilePayload('  Kelas  ', values)).toEqual({
			name: 'Kelas',
			max_projects: 5,
			max_active_containers: 5,
			max_active_deployments: 2,
			max_memory_mb: 512,
			max_cpu_millis: 1000,
			max_builds_per_hour: null,
			idle_sleep_minutes: 0,
			max_replicas: null
		});
	});
});

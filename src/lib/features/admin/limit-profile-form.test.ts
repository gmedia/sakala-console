import { describe, expect, it } from 'vitest';
import {
	ANY_REGION,
	emptyProfileValues,
	hasOptionalValue,
	invalidProfileLabels,
	PROFILE_GROUPS,
	PROFILE_NUMBER_FIELDS,
	profilePayload,
	regionOptions
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
		).toEqual([
			'max_builds_per_hour',
			'idle_sleep_minutes',
			'max_replicas',
			'max_databases',
			'max_database_storage_mb',
			'max_buckets',
			'max_bucket_storage_mb',
			'max_valkeys',
			'max_valkey_memory_mb',
			'max_custom_domains'
		]);
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
			max_replicas: null,
			max_databases: null,
			max_database_storage_mb: null,
			max_buckets: null,
			max_bucket_storage_mb: null,
			max_valkeys: null,
			max_valkey_memory_mb: null,
			max_custom_domains: null,
			default_region: null
		});
	});

	it('sends max_custom_domains, says the server allows one unless told otherwise, and caps it like the API', () => {
		const values = { ...emptyProfileValues(), max_custom_domains: '0' };
		expect(hasOptionalValue(values)).toBe(true);
		expect(profilePayload('Pilot', values)).toMatchObject({ max_custom_domains: 0 });
		const domains = PROFILE_NUMBER_FIELDS.find((field) => field.key === 'max_custom_domains');
		expect(domains).toMatchObject({ label: 'Custom domain', min: 0, max: 100 });
		expect(domains?.hint).toMatch(/ikut bawaan server \(1 kalau tidak diubah/);
		expect(domains?.hint).toMatch(/SAKALA_CUSTOM_DOMAINS_ENABLED/);
		expect(
			invalidProfileLabels('Pilot', { ...values, max_custom_domains: '101' }).includes(
				'Custom domain'
			)
		).toBe(true);
	});

	it('sends the Valkey limits, says the server opens none unless told to, and caps them like the API', () => {
		const values = { ...emptyProfileValues(), max_valkeys: '1', max_valkey_memory_mb: '64' };
		expect(hasOptionalValue(values)).toBe(true);
		expect(profilePayload('Pilot', values)).toMatchObject({
			max_valkeys: 1,
			max_valkey_memory_mb: 64
		});
		const valkeys = PROFILE_NUMBER_FIELDS.find((field) => field.key === 'max_valkeys');
		expect(valkeys).toMatchObject({ label: 'Valkey', min: 0, max: 20 });
		expect(valkeys?.hint).toMatch(/ikut bawaan server \(0 kalau tidak diubah/);
		expect(valkeys?.hint).toMatch(/SAKALA_VALKEY_ENABLED/);
		const memory = PROFILE_NUMBER_FIELDS.find((field) => field.key === 'max_valkey_memory_mb');
		expect(memory).toMatchObject({ min: 0, max: 10240 });
		expect(invalidProfileLabels('Pilot', { ...values, max_valkeys: '21' }).includes('Valkey')).toBe(
			true
		);
	});

	it('sends 0 buckets as a value, says the server default is 0, and caps the count at 100', () => {
		const values = { ...emptyProfileValues(), max_buckets: '0', max_bucket_storage_mb: '2048' };
		expect(hasOptionalValue(values)).toBe(true);
		expect(profilePayload('Kelas', values)).toMatchObject({
			max_buckets: 0,
			max_bucket_storage_mb: 2048
		});
		const buckets = PROFILE_NUMBER_FIELDS.find((field) => field.key === 'max_buckets');
		expect(buckets).toMatchObject({ label: 'Bucket', min: 0, max: 100 });
		expect(buckets?.hint).toMatch(/ikut bawaan server \(0 kalau tidak diubah/);
		expect(
			invalidProfileLabels('Kelas', { ...values, max_buckets: '101' }).includes('Bucket')
		).toBe(true);
	});

	it('sends 0 databases and 0 MB as values, and a chosen region by its slug', () => {
		const values = {
			...emptyProfileValues(),
			max_projects: '1',
			max_active_containers: '1',
			max_active_deployments: '1',
			max_memory_mb: '512',
			max_cpu_millis: '1000',
			max_databases: '0',
			max_database_storage_mb: '0'
		};
		expect(profilePayload('Tanpa database', values, 'jkt')).toMatchObject({
			max_databases: 0,
			max_database_storage_mb: 0,
			default_region: 'jkt'
		});
		expect(hasOptionalValue(emptyProfileValues(), 'jkt')).toBe(true);
		expect(hasOptionalValue(emptyProfileValues(), ANY_REGION)).toBe(false);
	});

	it('says what 0 and empty mean for the database limits, and that databases are a pilot', () => {
		const field = (key: string) => PROFILE_NUMBER_FIELDS.find((item) => item.key === key)!;
		expect(field('max_databases')).toMatchObject({ min: 0, max: 1000 });
		expect(field('max_databases').hint).toMatch(
			/0 berarti workspace ini tidak bisa membuat database/
		);
		expect(field('max_databases').hint).toMatch(/ikut bawaan server \(2 kalau tidak diubah\)/);
		expect(field('max_databases').hint).toMatch(/pilot terbatas/);
		expect(field('max_database_storage_mb')).toMatchObject({ min: 0, max: 1048576 });
		expect(field('max_database_storage_mb').hint).toMatch(/0 berarti semuanya dikunci/);
		expect(field('max_database_storage_mb').hint).toMatch(/512 MB kalau tidak diubah/);
	});

	it('keeps a saved region that no node reports anymore, so editing does not drop it', () => {
		expect(regionOptions(['jkt', 'sby'], 'sby')).toEqual(['jkt', 'sby']);
		expect(regionOptions(['jkt'], 'id-jog-1')).toEqual(['jkt', 'id-jog-1']);
		expect(regionOptions([], ANY_REGION)).toEqual([]);
	});
});

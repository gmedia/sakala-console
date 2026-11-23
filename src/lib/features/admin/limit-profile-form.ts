import type { LimitProfile, LimitProfileFields } from '$lib/api/resources/admin/accounts';
import { formatNumber } from './format';
import { IDLE_SLEEP_MINUTES_RANGE, MAX_REPLICAS_RANGE } from './profile-defaults';

export type ProfileNumberField = Exclude<keyof LimitProfileFields, 'name'>;

/** The three parts of the form, in page order. Opsional starts closed. */
export type ProfileFieldGroup = 'workspace' | 'project' | 'optional';

export const PROFILE_GROUPS: readonly { id: ProfileFieldGroup; title: string; lead: string }[] = [
	{
		id: 'workspace',
		title: 'Kapasitas workspace',
		lead: 'Dipakai bersama semua anggota dan semua proyek di workspace.'
	},
	{
		id: 'project',
		title: 'Sumber daya per proyek',
		lead: 'Batas untuk setiap container proyek.'
	},
	{
		id: 'optional',
		title: 'Opsional',
		lead: 'Build per jam, tidur otomatis, dan replika. Kosong berarti ikut bawaan server.'
	}
];

export type ProfileNumberSpec = {
	key: ProfileNumberField;
	label: string;
	group: ProfileFieldGroup;
	min: number;
	max: number;
	hint: string;
	optional?: boolean;
};

/**
 * sakala-api `PilotRuntimeLimitService::DEFAULT_MAX_BUILDS_PER_HOUR`: what an empty "Build per
 * jam" follows unless the server sets `SAKALA_PROJECT_MAX_BUILDS_PER_HOUR`.
 */
export const SERVER_DEFAULT_BUILDS_PER_HOUR = 20;

/** The API's own ranges (StoreLimitProfileRequest), so most mistakes show before sending. */
export const PROFILE_NUMBER_FIELDS: readonly ProfileNumberSpec[] = [
	{
		key: 'max_projects',
		label: 'Proyek',
		group: 'workspace',
		min: 1,
		max: 1000,
		hint: 'Jumlah proyek per workspace.'
	},
	{
		key: 'max_active_containers',
		label: 'Container berjalan',
		group: 'workspace',
		min: 1,
		max: 1000,
		hint: 'Proyek yang melayani atau sedang di-deploy sekaligus. Proyek yang tidur tidak dihitung.'
	},
	{
		key: 'max_active_deployments',
		label: 'Deployment berjalan',
		group: 'workspace',
		min: 1,
		max: 100,
		hint: 'Deployment yang berjalan bersamaan.'
	},
	{
		key: 'max_memory_mb',
		label: 'Memori per proyek (MB)',
		group: 'project',
		min: 64,
		max: 65536,
		hint: '64 sampai 65.536 MB.'
	},
	{
		key: 'max_cpu_millis',
		label: 'CPU per proyek (millicore)',
		group: 'project',
		min: 100,
		max: 64000,
		hint: '1.000 millicore sama dengan satu core.'
	},
	{
		key: 'max_builds_per_hour',
		label: 'Build per jam',
		group: 'optional',
		min: 1,
		max: 1000,
		// What sakala-api's PilotRuntimeLimitService::checkBuildRateLimit() counts.
		hint: `Deployment yang membangun image di workspace ini dalam 60 menit terakhir, termasuk yang gagal. Redeploy yang memakai ulang image tidak dihitung. Kosong berarti ikut bawaan server (${SERVER_DEFAULT_BUILDS_PER_HOUR} kalau tidak diubah).`,
		optional: true
	},
	{
		key: 'idle_sleep_minutes',
		label: 'Tidur otomatis (menit)',
		group: 'optional',
		...IDLE_SLEEP_MINUTES_RANGE,
		hint: `Kosong berarti ikut bawaan server, 0 berarti proyek tidak pernah tidur, atau 1 sampai ${formatNumber(IDLE_SLEEP_MINUTES_RANGE.max)} menit tanpa pengunjung.`,
		optional: true
	},
	{
		key: 'max_replicas',
		label: 'Maks. replika',
		group: 'optional',
		...MAX_REPLICAS_RANGE,
		hint: `Replika per proyek, ${MAX_REPLICAS_RANGE.min} sampai ${MAX_REPLICAS_RANGE.max}. Kosong berarti ${MAX_REPLICAS_RANGE.min}, jadi replika tidak aktif. Semua replika satu proyek berjalan di satu node, yang bisa membatasinya lebih rendah.`,
		optional: true
	}
];

/** A number input binds a number (or null when empty), and a prefill writes a string. */
export type ProfileNumberValues = Record<ProfileNumberField, string | number | null>;

export function emptyProfileValues(): ProfileNumberValues {
	return Object.fromEntries(
		PROFILE_NUMBER_FIELDS.map((field) => [field.key, ''])
	) as ProfileNumberValues;
}

export function profileValuesFrom(profile: LimitProfile): ProfileNumberValues {
	return Object.fromEntries(
		PROFILE_NUMBER_FIELDS.map((field) => [field.key, profile[field.key]?.toString() ?? ''])
	) as ProfileNumberValues;
}

export function rawProfileValue(values: ProfileNumberValues, key: ProfileNumberField): string {
	return String(values[key] ?? '').trim();
}

export function profileFieldProblem(
	field: ProfileNumberSpec,
	values: ProfileNumberValues
): string | null {
	const raw = rawProfileValue(values, field.key);
	if (!raw) {
		return field.optional
			? null
			: `Belum diisi. Isi bilangan bulat ${formatNumber(field.min)} sampai ${formatNumber(field.max)}.`;
	}
	const value = Number(raw);
	if (!Number.isInteger(value) || value < field.min || value > field.max) {
		return `Bilangan bulat ${formatNumber(field.min)} sampai ${formatNumber(field.max)}.`;
	}
	return null;
}

/** The labels of every field that cannot be sent yet, the name first. */
export function invalidProfileLabels(name: string, values: ProfileNumberValues): string[] {
	return [
		...(name.trim() ? [] : ['Nama']),
		...PROFILE_NUMBER_FIELDS.filter((field) => profileFieldProblem(field, values) !== null).map(
			(field) => field.label
		)
	];
}

/** Whether any optional field holds a value, which keeps the Opsional group open. */
export function hasOptionalValue(values: ProfileNumberValues): boolean {
	return PROFILE_NUMBER_FIELDS.some(
		(field) => field.optional && rawProfileValue(values, field.key) !== ''
	);
}

/** The body for create or update: integers, and `null` for an empty optional field. */
export function profilePayload(name: string, values: ProfileNumberValues): LimitProfileFields {
	const numbers = Object.fromEntries(
		PROFILE_NUMBER_FIELDS.map((field) => {
			const raw = rawProfileValue(values, field.key);
			return [field.key, raw ? Number(raw) : null];
		})
	) as Pick<LimitProfileFields, ProfileNumberField>;
	return { ...numbers, name: name.trim() };
}

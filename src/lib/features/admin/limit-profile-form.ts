import type { LimitProfile, LimitProfileFields } from '$lib/api/resources/admin/accounts';
import { formatNumber } from './format';
import {
	IDLE_SLEEP_MINUTES_RANGE,
	MAX_BUCKET_STORAGE_MB_RANGE,
	MAX_BUCKETS_RANGE,
	MAX_CUSTOM_DOMAINS_RANGE,
	MAX_DATABASE_STORAGE_MB_RANGE,
	MAX_DATABASES_RANGE,
	MAX_REPLICAS_RANGE,
	MAX_VALKEY_MEMORY_MB_RANGE,
	MAX_VALKEYS_RANGE
} from './profile-defaults';

export type ProfileNumberField = Exclude<keyof LimitProfileFields, 'name' | 'default_region'>;

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
		lead: 'Build, tidur, replika, database, bucket, Valkey, custom domain, dan region.'
	}
];

export type ProfileNumberSpec = {
	key: ProfileNumberField;
	label: string;
	group: ProfileFieldGroup;
	min: number;
	max: number;
	/** The whole rule; on the page it sits behind "Pelajari" when `short` is set. */
	hint: string;
	/** One line under the field (docs/UI_GUIDELINES.md, text budget). */
	short?: string;
	optional?: boolean;
};

/**
 * sakala-api `PilotRuntimeLimitService::DEFAULT_MAX_BUILDS_PER_HOUR`: what an empty "Build per
 * jam" follows unless the server sets `SAKALA_PROJECT_MAX_BUILDS_PER_HOUR`.
 */
export const SERVER_DEFAULT_BUILDS_PER_HOUR = 20;

/**
 * sakala-api `PilotRuntimeLimitService::DEFAULT_MAX_DATABASES` and
 * `DEFAULT_MAX_DATABASE_STORAGE_MB`: what empty database limits follow unless the server sets
 * `SAKALA_DATABASE_DEFAULT_MAX_COUNT` or `SAKALA_DATABASE_DEFAULT_MAX_STORAGE_MB`.
 */
export const SERVER_DEFAULT_MAX_DATABASES = 2;
export const SERVER_DEFAULT_DATABASE_STORAGE_MB = 512;

/**
 * sakala-api `PilotRuntimeLimitService::DEFAULT_MAX_BUCKETS` and `DEFAULT_MAX_BUCKET_STORAGE_MB`:
 * 0 and 0 unless the server sets `SAKALA_BUCKET_DEFAULT_MAX_COUNT` or
 * `SAKALA_BUCKET_DEFAULT_MAX_STORAGE_MB`, because bucket quotas commit real disk.
 */
export const SERVER_DEFAULT_MAX_BUCKETS = 0;
export const SERVER_DEFAULT_BUCKET_STORAGE_MB = 0;

/**
 * sakala-api `PilotRuntimeLimitService::DEFAULT_MAX_VALKEYS` and `DEFAULT_MAX_VALKEY_MEMORY_MB`: 0
 * and 0 unless the server sets `SAKALA_VALKEY_DEFAULT_MAX_COUNT` or
 * `SAKALA_VALKEY_DEFAULT_MAX_MEMORY_MB`, because a store holds its memory for as long as it exists.
 */
export const SERVER_DEFAULT_MAX_VALKEYS = 0;
export const SERVER_DEFAULT_VALKEY_MEMORY_MB = 0;

/**
 * sakala-api `PilotRuntimeLimitService::DEFAULT_MAX_CUSTOM_DOMAINS`: what an empty "Custom domain"
 * follows unless the server sets `SAKALA_CUSTOM_DOMAIN_DEFAULT_MAX_COUNT` (hosted decision, 25 Nov
 * 2026).
 */
export const SERVER_DEFAULT_MAX_CUSTOM_DOMAINS = 1;

/** Custom domains work only where the server turned them on; the help says so. */
const CUSTOM_DOMAIN_FLAG_NOTE =
	'Hanya berlaku kalau server menyalakan custom domain (SAKALA_CUSTOM_DOMAINS_ENABLED).';

/** Valkey runs only where the server turned it on; the help says so instead of promising it. */
const VALKEY_FLAG_NOTE =
	'Hanya berlaku kalau server menyalakan Valkey terkelola (SAKALA_VALKEY_ENABLED).';

/** Managed databases are a limited pilot; the help says so instead of promising them. */
const DATABASE_PILOT_NOTE =
	'Database terkelola masih pilot terbatas dan belum tentu tersedia di server ini.';

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
		short: `Kosong berarti bawaan server (${SERVER_DEFAULT_BUILDS_PER_HOUR}).`,
		optional: true
	},
	{
		key: 'idle_sleep_minutes',
		label: 'Tidur otomatis (menit)',
		group: 'optional',
		...IDLE_SLEEP_MINUTES_RANGE,
		hint: `Kosong berarti ikut bawaan server, 0 berarti proyek tidak pernah tidur, atau 1 sampai ${formatNumber(IDLE_SLEEP_MINUTES_RANGE.max)} menit tanpa pengunjung.`,
		short: '0 berarti proyek tidak pernah tidur.',
		optional: true
	},
	{
		key: 'max_replicas',
		label: 'Maks. replika',
		group: 'optional',
		...MAX_REPLICAS_RANGE,
		hint: `Replika per proyek, ${MAX_REPLICAS_RANGE.min} sampai ${MAX_REPLICAS_RANGE.max}. Kosong berarti ${MAX_REPLICAS_RANGE.min}, jadi replika tidak aktif. Semua replika satu proyek berjalan di satu node, yang bisa membatasinya lebih rendah.`,
		short: `${MAX_REPLICAS_RANGE.min} sampai ${MAX_REPLICAS_RANGE.max}. Kosong berarti ${MAX_REPLICAS_RANGE.min}.`,
		optional: true
	},
	{
		key: 'max_databases',
		label: 'Database',
		group: 'optional',
		...MAX_DATABASES_RANGE,
		hint: `Database terkelola per workspace. 0 berarti workspace ini tidak bisa membuat database. Kosong berarti ikut bawaan server (${SERVER_DEFAULT_MAX_DATABASES} kalau tidak diubah). ${DATABASE_PILOT_NOTE}`,
		short: '0 berarti tidak bisa membuat database.',
		optional: true
	},
	{
		key: 'max_database_storage_mb',
		label: 'Penyimpanan database (MB)',
		group: 'optional',
		...MAX_DATABASE_STORAGE_MB_RANGE,
		hint: `Total ukuran semua database terkelola di workspace. Selama pemakaian mencapai batas ini, database workspace dikunci sampai ukurannya turun lagi; 0 berarti semuanya dikunci. Kosong berarti ikut bawaan server (${formatNumber(SERVER_DEFAULT_DATABASE_STORAGE_MB)} MB kalau tidak diubah).`,
		short: 'Total semua database di workspace.',
		optional: true
	},
	{
		key: 'max_buckets',
		label: 'Bucket',
		group: 'optional',
		...MAX_BUCKETS_RANGE,
		hint: `Bucket S3 terkelola per workspace. 0 berarti workspace ini tidak bisa membuat bucket. Kosong berarti ikut bawaan server (${SERVER_DEFAULT_MAX_BUCKETS} kalau tidak diubah, jadi bucket dibuka per workspace).`,
		short: '0 berarti tidak bisa membuat bucket.',
		optional: true
	},
	{
		key: 'max_bucket_storage_mb',
		label: 'Penyimpanan bucket (MB)',
		group: 'optional',
		...MAX_BUCKET_STORAGE_MB_RANGE,
		hint: `Jumlah kuota semua bucket di workspace, dipesan di disk server saat bucket dibuat. Menurunkannya tidak mengecilkan bucket yang ada, hanya menahan bucket baru dan kenaikan kuota; 0 berarti tidak ada bucket baru. Kosong berarti ikut bawaan server (${formatNumber(SERVER_DEFAULT_BUCKET_STORAGE_MB)} MB kalau tidak diubah).`,
		short: 'Kuota semua bucket, dipesan di disk.',
		optional: true
	},
	{
		key: 'max_valkeys',
		label: 'Valkey',
		group: 'optional',
		...MAX_VALKEYS_RANGE,
		hint: `Valkey terkelola per workspace. 0 berarti workspace ini tidak bisa membuat Valkey. Kosong berarti ikut bawaan server (${SERVER_DEFAULT_MAX_VALKEYS} kalau tidak diubah, jadi Valkey dibuka per workspace). ${VALKEY_FLAG_NOTE}`,
		short: '0 berarti tidak bisa membuat Valkey.',
		optional: true
	},
	{
		key: 'max_valkey_memory_mb',
		label: 'Memori Valkey (MB)',
		group: 'optional',
		...MAX_VALKEY_MEMORY_MB_RANGE,
		hint: `Jumlah ukuran semua Valkey di workspace (32, 64, atau 128 MB per Valkey), dicadangkan di server sejak Valkey dibuat. Menurunkannya tidak mengecilkan Valkey yang ada, hanya menahan Valkey baru dan pembesaran; 0 berarti tidak ada Valkey baru. Kosong berarti ikut bawaan server (${formatNumber(SERVER_DEFAULT_VALKEY_MEMORY_MB)} MB kalau tidak diubah).`,
		short: 'Ukuran semua Valkey, dicadangkan di server.',
		optional: true
	},
	{
		key: 'max_custom_domains',
		label: 'Custom domain',
		group: 'optional',
		...MAX_CUSTOM_DOMAINS_RANGE,
		hint: `Custom domain semua proyek di workspace, termasuk yang menunggu DNS, gagal, atau nonaktif. 0 berarti workspace ini tidak bisa menambah domain. Menurunkannya tidak menghapus domain yang ada. Kosong berarti ikut bawaan server (${SERVER_DEFAULT_MAX_CUSTOM_DOMAINS} kalau tidak diubah). ${CUSTOM_DOMAIN_FLAG_NOTE}`,
		short: 'Semua domain proyek, termasuk yang gagal.',
		optional: true
	}
];

/** The region's line under its field, and the whole rule behind "Pelajari". */
export const REGION_HINT = {
	short: 'Untuk proyek dan database baru yang tidak memilih region.',
	full: 'Proyek dan database baru di workspace ini memakai region ini kalau tidak memilih sendiri. Proyek yang sudah berjalan tetap di node-nya sampai di-deploy ulang ke node lain.'
} as const;

/** The Opsional group's rule for an empty field, said once above its fields. */
export const OPTIONAL_EMPTY_RULE = 'Kosong berarti ikut bawaan server.';

/** The region select's value for "any region", which the API takes as `null`. */
export const ANY_REGION = '';

/** The regions to offer: the API's list, plus the profile's own when no node reports it anymore. */
export function regionOptions(available: readonly string[], current: string): string[] {
	return current && !available.includes(current) ? [...available, current] : [...available];
}

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
export function hasOptionalValue(values: ProfileNumberValues, region = ANY_REGION): boolean {
	return (
		region !== ANY_REGION ||
		PROFILE_NUMBER_FIELDS.some(
			(field) => field.optional && rawProfileValue(values, field.key) !== ''
		)
	);
}

/**
 * The body for create or update: integers, `null` for an empty optional field, and `null` for any
 * region.
 */
export function profilePayload(
	name: string,
	values: ProfileNumberValues,
	region = ANY_REGION
): LimitProfileFields {
	const numbers = Object.fromEntries(
		PROFILE_NUMBER_FIELDS.map((field) => {
			const raw = rawProfileValue(values, field.key);
			return [field.key, raw ? Number(raw) : null];
		})
	) as Pick<LimitProfileFields, ProfileNumberField>;
	return { ...numbers, name: name.trim(), default_region: region || null };
}

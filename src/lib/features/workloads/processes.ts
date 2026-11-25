import type { PilotLimits } from '$lib/api/resources/pilot-limits';
import type { ProcessCrash, ProcessPayload, ProjectProcess } from '$lib/api/resources/processes';
import { LARAVEL_FRAMEWORK } from '$lib/features/projects/build-help';
import { commandError, parseWholeNumber, PROCESS_RULES } from './rules';
import { formatZonedTime } from './time';

export const PROCESS_COPY = {
	section: 'Proses',
	/** One line under the title; the full explanation sits behind "Pelajari". */
	intro: 'Perintah yang terus berjalan di latar, misalnya antrean.',
	introLearn:
		'web melayani alamat proyek. Worker menjalankan perintah lain dari image dan variabel yang sama, tanpa alamat, misalnya antrean Laravel.',
	webName: 'web',
	webBadge: 'Melayani alamat',
	webDescription: 'Perintahnya diatur di Build dan start.',
	add: 'Tambah worker',
	addTitle: 'Tambah worker',
	editTitle: (name: string) => `Ubah worker ${name}`,
	save: 'Simpan worker',
	saving: 'Menyimpan...',
	edit: 'Ubah',
	delete: 'Hapus',
	deleteTitle: (name: string) => `Hapus worker ${name}?`,
	deleteDescription:
		'Definisinya dihapus sekarang. Container worker yang sedang berjalan berhenti saat deployment berikutnya.',
	deleteConfirm: 'Hapus worker',
	nameLabel: 'Nama',
	nameHint: 'Huruf kecil, angka, dan tanda minus, diawali huruf. Tampil di log, misalnya queue.',
	commandLabel: 'Perintah',
	commandHint:
		'Dijalankan dengan sh -c di container worker dan harus terus berjalan, misalnya php artisan queue:work.',
	replicasLabel: 'Container',
	replicasHint: (max: number) =>
		max > 1
			? `0 sampai ${max}. 0 menyimpan worker tanpa menjalankannya.`
			: '0 atau 1. 0 menyimpan worker tanpa menjalankannya.',
	resourcesToggle: 'Memori dan CPU',
	resourcesHint: 'Kosongkan supaya mengikuti memori dan CPU proyek.',
	memoryLabel: 'Memori per container (MB)',
	cpuLabel: 'CPU per container (millicore)',
	resourceMax: (max: number, unit: string) => `Paling banyak ${max} ${unit}.`,
	followsProject: 'ikut proyek',
	notRunning: 'Tidak dijalankan',
	containers: (count: number) => `${count} container`,
	crash: 'Crash',
	crashRecovering: 'Crash, sedang menyala lagi',
	emptyTitle: 'Belum ada worker',
	emptyDescription:
		'Tambahkan worker kalau aplikasimu memproses antrean atau tugas lain di luar request.',
	suggestionTitle: 'Saran untuk Laravel',
	suggestionUse: 'Pakai saran ini',
	applies: 'Perubahan worker berlaku mulai deployment berikutnya.',
	saved: (name: string) => `Worker ${name} tersimpan. Berlaku mulai deployment berikutnya.`,
	deleted: (name: string) => `Worker ${name} dihapus. Berhenti saat deployment berikutnya.`,
	readOnly: 'Worker hanya bisa diubah pemilik dan anggota workspace.',
	loadFailed: 'Daftar worker belum bisa dimuat. Muat ulang halaman ini.',
	unavailable: 'Worker belum bisa dipakai di instalasi Sakala ini.',
	saveFailed: 'Worker belum tersimpan. Periksa isiannya, lalu simpan lagi.',
	deleteFailed: 'Worker belum terhapus. Muat ulang halaman, lalu hapus lagi.',
	limitReached: (max: number) =>
		`Satu proyek paling banyak punya ${max} worker. Hapus worker yang tidak dipakai untuk menambah yang baru.`
} as const;

export const PROCESS_NAME_ERRORS = {
	empty: 'Isi nama worker, misalnya queue.',
	tooLong: `Nama worker paling panjang ${PROCESS_RULES.nameMaxLength} karakter.`,
	pattern: 'Nama worker hanya boleh huruf kecil, angka, dan tanda minus, dan harus diawali huruf.',
	reserved: 'Nama web, release, dan job dipakai Sakala sendiri. Pilih nama lain, misalnya queue.',
	duplicate: 'Proyek ini sudah punya worker dengan nama itu.'
} as const;

/** What the form holds: text, so an emptied number stays empty until it is checked. */
export type ProcessDraft = {
	name: string;
	command: string;
	replicas: string;
	memory_mb: string;
	cpu_millis: string;
};

export type ProcessDraftErrors = Partial<Record<keyof ProcessDraft, string>>;

export type ProcessDraftLimits = {
	maxReplicas: number;
	maxMemoryMb?: number;
	maxCpuMillis?: number;
	/** Names of the project's other workers. */
	takenNames: readonly string[];
};

export function emptyProcessDraft(): ProcessDraft {
	return {
		name: '',
		command: '',
		replicas: String(PROCESS_RULES.defaultReplicas),
		memory_mb: '',
		cpu_millis: ''
	};
}

export function processDraftFrom(process: ProjectProcess): ProcessDraft {
	return {
		name: process.name,
		command: process.command,
		replicas: String(process.replicas),
		memory_mb: process.memory_mb?.toString() ?? '',
		cpu_millis: process.cpu_millis?.toString() ?? ''
	};
}

export function processNameError(name: string, takenNames: readonly string[]): string | undefined {
	if (!name) return PROCESS_NAME_ERRORS.empty;
	if (name.length > PROCESS_RULES.nameMaxLength) return PROCESS_NAME_ERRORS.tooLong;
	if (!PROCESS_RULES.namePattern.test(name)) return PROCESS_NAME_ERRORS.pattern;
	if (PROCESS_RULES.reservedNames.includes(name)) return PROCESS_NAME_ERRORS.reserved;
	if (takenNames.includes(name)) return PROCESS_NAME_ERRORS.duplicate;
	return undefined;
}

function resourceError(value: string, max: number | undefined, label: string): string | undefined {
	const parsed = parseWholeNumber(value);
	if (parsed === null) return undefined;
	if (Number.isNaN(parsed) || parsed < 1) return `${label} harus bilangan bulat lebih dari 0.`;
	if (max !== undefined && parsed > max) return `${label} paling banyak ${max} di workspace ini.`;
	return undefined;
}

/** The same checks as StoreProjectProcessRequest, in its words where it has them. */
export function processDraftErrors(
	draft: ProcessDraft,
	limits: ProcessDraftLimits
): ProcessDraftErrors {
	const replicas = parseWholeNumber(draft.replicas);
	const replicasError =
		replicas === null || Number.isNaN(replicas)
			? `Isi jumlah container, ${PROCESS_RULES.minReplicas} sampai ${limits.maxReplicas}.`
			: replicas > limits.maxReplicas
				? `Satu worker di workspace ini paling banyak berjalan dengan ${limits.maxReplicas} replika.`
				: undefined;

	return {
		name: processNameError(draft.name.trim(), limits.takenNames),
		command: commandError(draft.command, 'worker'),
		replicas: replicasError,
		memory_mb: resourceError(draft.memory_mb, limits.maxMemoryMb, 'Memori'),
		cpu_millis: resourceError(draft.cpu_millis, limits.maxCpuMillis, 'CPU')
	};
}

export function hasProcessDraftErrors(errors: ProcessDraftErrors): boolean {
	return Object.values(errors).some(Boolean);
}

/** The body for POST, or the changed fields for PATCH when `original` is given. */
export function processPayload(
	draft: ProcessDraft,
	original?: ProjectProcess
): Partial<ProcessPayload> {
	const full: ProcessPayload = {
		name: draft.name.trim(),
		command: draft.command.trim(),
		replicas: parseWholeNumber(draft.replicas) ?? PROCESS_RULES.defaultReplicas,
		memory_mb: parseWholeNumber(draft.memory_mb),
		cpu_millis: parseWholeNumber(draft.cpu_millis)
	};
	if (!original) return full;
	return Object.fromEntries(
		Object.entries(full).filter(([key, value]) => original[key as keyof ProcessPayload] !== value)
	) as Partial<ProcessPayload>;
}

/** Field errors of a 422, mapped onto the form. */
export function processErrorsFromApi(errors: Record<string, string[]>): ProcessDraftErrors {
	return {
		name: errors.name?.[0],
		command: errors.command?.[0],
		replicas: errors.replicas?.[0],
		memory_mb: errors.memory_mb?.[0],
		cpu_millis: errors.cpu_millis?.[0]
	};
}

export function processResourcesText(process: Pick<ProjectProcess, 'memory_mb' | 'cpu_millis'>) {
	const memory = process.memory_mb ? `${process.memory_mb} MB` : PROCESS_COPY.followsProject;
	const cpu = process.cpu_millis ? `${process.cpu_millis} millicore` : PROCESS_COPY.followsProject;
	return `Memori ${memory}, CPU ${cpu}`;
}

/**
 * One line about a crashing worker: how it exited and since when, in the viewer's zone. An exit
 * with code 0 never reaches here (the agent does not count it as a crash).
 */
export function processCrashText(crash: ProcessCrash, timezone: string): string {
	const parts = [
		crash.oom_killed
			? 'Kehabisan memori'
			: crash.exit_code !== null
				? `Keluar dengan kode ${crash.exit_code}`
				: 'Berhenti sendiri'
	];
	if (crash.restart_count) parts.push(`restart ${crash.restart_count} kali`);
	parts.push(`sejak ${formatZonedTime(crash.since, timezone)}`);
	return parts.join(', ');
}

export type WorkerQuota = {
	max: number;
	/** Worker containers of the workspace's serving or deploying projects. */
	current: number;
	/** The project's own definitions, replicas added up. */
	defined: number;
	maxActiveContainers?: number;
	currentActiveContainers?: number;
};

export function workerQuota(
	limits: PilotLimits | undefined,
	processes: readonly Pick<ProjectProcess, 'replicas'>[]
): WorkerQuota | null {
	const max = limits?.quotas.max_worker_containers;
	if (max === undefined) return null;
	return {
		max,
		current: limits?.quotas.current_worker_containers_count ?? 0,
		defined: processes.reduce((sum, process) => sum + process.replicas, 0),
		maxActiveContainers: limits?.quotas.max_active_containers,
		currentActiveContainers: limits?.quotas.current_active_containers_count
	};
}

/** The quota under the list: what the workspace may run, and that workers take container slots. */
export function workerQuotaText(quota: WorkerQuota): string {
	if (quota.max === 0) {
		return 'Workspace ini belum bisa menjalankan worker. Kamu tetap bisa menyimpan worker dengan 0 container, atau minta admin Sakala membuka batasnya.';
	}
	const shared =
		quota.maxActiveContainers !== undefined
			? ` Setiap container worker juga memakai satu slot container berjalan workspace (${quota.currentActiveContainers ?? 0} dari ${quota.maxActiveContainers} terpakai).`
			: ' Setiap container worker juga memakai satu slot container berjalan workspace.';
	return `Workspace ini bisa menjalankan ${quota.max} container worker sekaligus, ${quota.current} sedang berjalan.${shared}`;
}

/**
 * What inspection does not suggest yet (ADR-022 leaves it to the API, which has no field for it):
 * for a detected Laravel project the Console offers the queue worker of the ADR's closed set.
 */
export const LARAVEL_QUEUE_WORKER = {
	name: 'queue',
	command: 'php artisan queue:work --sleep=3 --tries=3 --max-time=3600'
} as const;

export function processSuggestion(
	framework: string | null | undefined,
	processes: readonly Pick<ProjectProcess, 'name' | 'command'>[]
): typeof LARAVEL_QUEUE_WORKER | null {
	if (framework !== LARAVEL_FRAMEWORK) return null;
	const taken = processes.some(
		(process) =>
			process.name === LARAVEL_QUEUE_WORKER.name || process.command.includes('queue:work')
	);
	return taken ? null : LARAVEL_QUEUE_WORKER;
}

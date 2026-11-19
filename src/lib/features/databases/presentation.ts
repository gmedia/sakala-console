import { ApiError, DATABASE_ERROR_CODES, getErrorMessage } from '$lib/api/errors';
import { parseDatabaseRefusal } from '$lib/api/resources/database-refusals';
import {
	DATABASE_COMMANDS,
	type Database,
	type DatabaseExtension,
	type DatabaseRotationRedeploy,
	type KnownDatabaseStatus
} from '$lib/api/resources/databases';
import type { PilotLimits } from '$lib/api/resources/pilot-limits';
import type { BadgeTone } from '$lib/components/ui/Badge.svelte';

/** The API's megabyte (DatabaseSize::BYTES_PER_MEGABYTE), so quotas read the same on both sides. */
export const BYTES_PER_MB = 1024 * 1024;
const MB_PER_GB = 1024;

/**
 * At this share of the storage quota the API warns the workspace's owners and members, and at the
 * full quota it locks every database of the workspace (`databases:enforce-storage-quota`).
 */
export const STORAGE_WARNING_RATIO = 0.8;
export const STORAGE_FULL_RATIO = 1;

/** While a database is created or dropped the node reports back within seconds, so poll briefly. */
export const DATABASE_TRANSITION_POLL_MS = 5_000;

/**
 * A rotation usually completes in about two seconds, and the redeploys are queued right after, so
 * the page asks more often until both are known.
 */
export const ROTATION_POLL_MS = 2_000;

/** Longest display name the API accepts (ManagedDatabase::MAX_NAME_LENGTH). */
export const DATABASE_NAME_MAX_LENGTH = 100;

export { DATABASE_VARIABLES } from './variables';

export const ENGINE_LABELS: Record<string, string> = { postgresql: 'PostgreSQL' };

/** "Otomatis (jkt)" when the workspace has a default region, which is what the API then uses. */
export function regionAutoLabel(defaultRegion: string | null | undefined): string {
	return defaultRegion
		? `${DATABASE_COPY.regionAuto} (${defaultRegion})`
		: DATABASE_COPY.regionAuto;
}

export function regionAutoHint(defaultRegion: string | null | undefined): string {
	return defaultRegion
		? `Memakai region bawaan workspace, ${defaultRegion}.`
		: DATABASE_COPY.regionAutoHint;
}

/** How a sentence names the workspace: a team by its name, the personal one by what it is. */
export function workspacePhrase(workspace: { name: string; type: string } | null): string {
	if (!workspace) return 'workspace ini';
	return workspace.type === 'personal' ? 'workspace pribadimu' : workspace.name;
}

export function engineLabel(engine: string): string {
	return ENGINE_LABELS[engine] ?? engine;
}

export const DATABASE_COPY = {
	nav: 'Database',
	create: 'Buat database',
	creating: 'Membuat...',
	regionAuto: 'Otomatis',
	regionAutoHint:
		'Workspace ini tidak punya region bawaan, jadi Sakala memilih server database yang tersedia.',
	regionRule: 'Proyek hanya bisa memakai database di region yang sama.',
	nameHint: 'Hanya untuk ditampilkan di Sakala. Nama database dan user di server dibuat acak.',
	notMeasured: 'Belum diukur',
	noProjects: 'Belum dipasang ke proyek',
	redeployLink: 'Buka proyek untuk redeploy',
	privateNetwork:
		'Alamat ini hanya bisa dijangkau aplikasi yang berjalan di Sakala, bukan dari laptop atau layanan luar.',
	credentialsAudit: 'Setiap kali password ditampilkan, Sakala mencatatnya di log audit workspace.',
	credentialsOwnerOnly:
		'Password dan DATABASE_URL hanya bisa dilihat pemilik workspace. Proyek yang terpasang tetap menerima keduanya otomatis saat deploy.',
	credentialsNotReady: 'Detail koneksi tersedia setelah database siap.',
	endpointMissing: 'Belum dilaporkan',
	endpointPending:
		'Server database belum melaporkan alamatnya. Muat ulang halaman ini beberapa saat lagi.',
	reveal: 'Tampilkan password',
	releaseTitle: 'Migration lewat release command',
	releaseBody:
		'Sakala tidak menjalankan migration sendiri. Isi release command di pengaturan proyek: perintah itu jalan sekali setiap deploy, setelah build dan sebelum versi baru menerima trafik.',
	releaseDocs: 'Baca panduan release command',
	extensionsNote:
		'Daftar extension yang sudah terpasang belum ditampilkan di sini. Memasang ulang extension yang sudah ada aman dan tidak mengubah apa pun.',
	viewerNote: 'Kamu pengamat di workspace ini, jadi hanya bisa melihat database-nya.',
	unavailableTitle: 'Database terkelola belum tersedia di server ini',
	unavailableBody:
		'Belum ada server database yang terhubung ke Sakala ini, jadi database baru belum bisa dibuat.'
} as const;

/**
 * Whether this installation offers no managed databases now (`databases.available` on pilot-limits).
 * Unknown, while the limits load or from an older API, is not "unavailable": the page keeps its
 * actions rather than hiding them on a guess.
 */
export function databasesUnavailable(
	limits: { databases?: { available: boolean } } | undefined
): boolean {
	return limits?.databases?.available === false;
}

/* ---------- Status ---------- */

export type DatabaseStatusView = {
	label: string;
	tone: BadgeTone;
	/** What the status means for the apps that use it, and what to do about it. */
	description: string;
	/** The node is working on it; the page polls until it settles. */
	transitional: boolean;
};

const STATUS_VIEWS: Record<KnownDatabaseStatus, Omit<DatabaseStatusView, 'description'>> = {
	provisioning: { label: 'Menyiapkan', tone: 'running', transitional: true },
	ready: { label: 'Siap', tone: 'success', transitional: false },
	failed: { label: 'Gagal', tone: 'error', transitional: false },
	deleting: { label: 'Menghapus', tone: 'queued', transitional: true },
	locked: { label: 'Terkunci', tone: 'warning', transitional: false }
};

const STATUS_DESCRIPTIONS: Record<KnownDatabaseStatus, string> = {
	provisioning:
		'Server database sedang membuat database ini. Halaman ini memperbarui sendiri begitu siap.',
	ready: 'Menerima koneksi dari proyek yang terpasang.',
	failed: 'Database ini gagal dibuat, jadi tidak bisa dipakai. Hapus lalu buat database baru.',
	deleting: 'Server database sedang menghapus database ini beserta datanya.',
	locked:
		'Penyimpanan database workspace ini penuh, jadi aplikasi tidak bisa terhubung. Hapus database yang tidak dipakai, atau minta admin Sakala menaikkan kuota. Backup malam tetap berjalan.'
};

function isKnownStatus(status: string): status is KnownDatabaseStatus {
	return status in STATUS_VIEWS;
}

/** The label, tone, and meaning of a status. A status from a newer API still shows as itself. */
export function databaseStatusView(
	database: Pick<Database, 'status' | 'last_failure'>
): DatabaseStatusView {
	if (!isKnownStatus(database.status)) {
		return {
			label: database.status,
			tone: 'neutral',
			description:
				'Status ini belum dikenal Console. Muat ulang halaman untuk melihat yang terbaru.',
			transitional: false
		};
	}
	const view = STATUS_VIEWS[database.status];
	const failure = database.last_failure;
	const description =
		database.status === 'failed' && failure?.command === DATABASE_COMMANDS.create
			? `${failure.summary} Hapus database ini lalu buat lagi.`
			: STATUS_DESCRIPTIONS[database.status];
	return { ...view, description };
}

const ROW_NOTES: Partial<Record<KnownDatabaseStatus, string>> = {
	provisioning: 'Sedang dibuat di server database',
	failed: 'Gagal dibuat. Hapus lalu buat lagi.',
	deleting: 'Sedang dihapus beserta datanya',
	locked: 'Aplikasi tidak bisa terhubung karena penyimpanan workspace penuh'
};

/** One line under a list row's name, for the statuses that need one. */
export function databaseRowNote(database: Pick<Database, 'status'>): string | null {
	return isKnownStatus(database.status) ? (ROW_NOTES[database.status] ?? null) : null;
}

/**
 * `jkt`, or `Otomatis` for a database on a node without a region: Sakala picked the server. The
 * workspace's default region is not shown in its place, because a database with a region-less node
 * does not run there.
 */
export function regionText(region: string | null): string {
	return region ?? DATABASE_COPY.regionAuto;
}

export function isTransitional(database: Pick<Database, 'status'>): boolean {
	return isKnownStatus(database.status) && STATUS_VIEWS[database.status].transitional;
}

/** `ready` and `locked` are on the node: the superuser still reaches a locked one. */
export function isOnNode(database: Pick<Database, 'status'>): boolean {
	return database.status === 'ready' || database.status === 'locked';
}

/**
 * A rotation whose result is not known yet: the node has not reported, or it has and the API is
 * still queueing the redeploys that were asked for.
 */
export function isRotationSettling(
	database: Partial<Pick<Database, 'password_rotation'>>
): boolean {
	const rotation = database.password_rotation;
	if (!rotation) return false;
	if (rotation.status === 'pending') return true;
	return (
		rotation.status === 'completed' && rotation.redeploy_attached && rotation.redeploys === null
	);
}

/** Poll while a rotation settles or the node creates or drops a database, and not at all otherwise. */
export function resolveDatabasePollInterval(
	databases:
		readonly (Pick<Database, 'status'> & Partial<Pick<Database, 'password_rotation'>>)[] | undefined
): number | false {
	if (databases?.some(isRotationSettling)) return ROTATION_POLL_MS;
	return databases?.some(isTransitional) ? DATABASE_TRANSITION_POLL_MS : false;
}

export type ProvisioningStep = { label: string; state: 'done' | 'current' | 'pending' };

/**
 * The steps of a creation, from what the API can tell: the request exists, the node is working on
 * it, and it is ready. The API does not say how far the node got, so there is no percentage.
 */
export function provisioningSteps(database: Pick<Database, 'status'>): ProvisioningStep[] {
	const ready = database.status !== 'provisioning';
	return [
		{ label: 'Permintaan diterima', state: 'done' },
		{ label: 'Server database membuat database', state: ready ? 'done' : 'current' },
		{ label: 'Siap dipakai', state: ready ? 'done' : 'pending' }
	];
}

/**
 * The failure to show beside the status, when it is not already the status's own explanation.
 * A failed creation is explained by the status; a failed extension install or rotation is not.
 */
export function separateFailure(database: Pick<Database, 'status' | 'last_failure'>) {
	const failure = database.last_failure;
	if (!failure) return null;
	if (database.status === 'failed' && failure.command === DATABASE_COMMANDS.create) return null;
	return failure;
}

/* ---------- Sizes and quota ---------- */

const sizeFormat = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });
const countFormat = new Intl.NumberFormat('id-ID');

/** `12 MB`, `7,5 MB`, `1,2 GB`, in the API's binary megabytes. */
export function formatMegabytes(megabytes: number): string {
	return megabytes >= MB_PER_GB
		? `${sizeFormat.format(megabytes / MB_PER_GB)} GB`
		: `${sizeFormat.format(megabytes)} MB`;
}

export function formatDatabaseSize(bytes: number | null | undefined): string {
	return bytes == null ? DATABASE_COPY.notMeasured : formatMegabytes(bytes / BYTES_PER_MB);
}

export type StorageLevel = 'ok' | 'warning' | 'full';

export type StorageMeter = {
	/** 0 to 1, capped, for the bar's width. */
	ratio: number;
	level: StorageLevel;
	/** `12 MB dari 512 MB`. */
	label: string;
	/** The same, with the share, for a screen reader. */
	accessibleLabel: string;
};

function storageLevel(ratio: number): StorageLevel {
	if (ratio >= STORAGE_FULL_RATIO) return 'full';
	if (ratio >= STORAGE_WARNING_RATIO) return 'warning';
	return 'ok';
}

/** A used size against a quota in MB. `0` MB means no storage at all, which is already full. */
export function storageMeter(usedBytes: number | null, quotaMb: number): StorageMeter {
	const used = usedBytes ?? 0;
	const quotaBytes = quotaMb * BYTES_PER_MB;
	const raw = quotaBytes === 0 ? STORAGE_FULL_RATIO : used / quotaBytes;
	const percent = Math.round(raw * 100);
	const usedLabel = formatDatabaseSize(usedBytes);
	const label = `${usedLabel} dari ${formatMegabytes(quotaMb)}`;
	return {
		ratio: Math.min(raw, 1),
		level: storageLevel(raw),
		label,
		accessibleLabel:
			usedBytes == null
				? `${label}, ukurannya belum diukur`
				: `${label}, ${countFormat.format(percent)}% dari kuota`
	};
}

export type DatabaseQuota = {
	count: { used: number; max: number; label: string; full: boolean };
	storage: StorageMeter;
	/** Why a new database would be refused now, or `null` when it would not. */
	blockedReason: string | null;
};

type QuotaFields = Pick<
	PilotLimits['quotas'],
	| 'max_databases'
	| 'current_databases_count'
	| 'max_database_storage_mb'
	| 'current_database_storage_bytes'
>;

export const QUOTA_COPY = {
	disabled:
		'Workspace ini belum bisa membuat database. Minta admin Sakala mengaktifkannya lewat profil batas workspace.',
	countFull: (max: number) =>
		`Workspace ini sudah memakai ${countFormat.format(max)} dari ${countFormat.format(max)} database. Hapus database yang tidak dipakai, atau minta admin Sakala menaikkan batasnya.`,
	storageFull:
		'Penyimpanan database workspace ini penuh, jadi database baru akan langsung terkunci. Hapus database yang tidak dipakai, atau minta admin Sakala menaikkan kuota.',
	storageWarning:
		'Penyimpanan database hampir penuh. Begitu penuh, semua database di workspace ini dikunci dan aplikasi tidak bisa terhubung.'
} as const;

/** `1 dari 2 database` and `12 MB dari 512 MB`, or `null` for an API without database quotas. */
export function databaseQuota(quotas: Partial<QuotaFields> | undefined): DatabaseQuota | null {
	if (
		quotas?.max_databases === undefined ||
		quotas.current_databases_count === undefined ||
		quotas.max_database_storage_mb === undefined ||
		quotas.current_database_storage_bytes === undefined
	) {
		return null;
	}
	const max = quotas.max_databases;
	const used = quotas.current_databases_count;
	const storage = storageMeter(
		quotas.current_database_storage_bytes,
		quotas.max_database_storage_mb
	);
	const countFull = used >= max;
	let blockedReason: string | null = null;
	if (max === 0) blockedReason = QUOTA_COPY.disabled;
	else if (countFull) blockedReason = QUOTA_COPY.countFull(max);
	else if (storage.level === 'full') blockedReason = QUOTA_COPY.storageFull;

	return {
		count: {
			used,
			max,
			label: `${countFormat.format(used)} dari ${countFormat.format(max)} database`,
			full: countFull
		},
		storage,
		blockedReason
	};
}

/* ---------- Extensions ---------- */

export type ExtensionInfo = { name: DatabaseExtension; label: string; description: string };

/** The allow-list with what each one is for, in the API's order. */
export const EXTENSION_INFO: Record<DatabaseExtension, Omit<ExtensionInfo, 'name'>> = {
	pgcrypto: {
		label: 'pgcrypto',
		description: 'Fungsi hash dan enkripsi di SQL, misalnya crypt() dan digest().'
	},
	citext: {
		label: 'citext',
		description: 'Tipe teks yang tidak membedakan huruf besar dan kecil, cocok untuk email.'
	},
	pg_trgm: {
		label: 'pg_trgm',
		description: "Pencarian teks yang mirip, dan indeks untuk LIKE '%kata%'."
	},
	unaccent: {
		label: 'unaccent',
		description: 'Mengabaikan aksen saat mencari, jadi "café" cocok dengan "cafe".'
	},
	hstore: { label: 'hstore', description: 'Pasangan kunci dan nilai di satu kolom.' },
	vector: {
		label: 'vector (pgvector)',
		description:
			'Menyimpan dan mencari embedding untuk fitur AI. Bisa belum tersedia di server database.'
	}
};

/** A failed install, which `last_failure` reports without naming the extension. */
export function extensionFailure(database: Pick<Database, 'last_failure'>) {
	return database.last_failure?.command === DATABASE_COMMANDS.installExtension
		? database.last_failure
		: null;
}

/** A failed rotation keeps the old password, which `last_failure` reports. */
export function rotationFailure(database: Pick<Database, 'last_failure'>) {
	return database.last_failure?.command === DATABASE_COMMANDS.rotatePassword
		? database.last_failure
		: null;
}

/* ---------- Password rotation ---------- */

export const ROTATION_COPY = {
	title: 'Ganti password',
	lead: 'Buat password baru kalau yang lama mungkin bocor.',
	action: 'Ganti password',
	dialogTitle: 'Ganti password database?',
	dialogConfirm: 'Ganti password',
	dialogBusy: 'Meminta...',
	dialogEffect:
		'Password lama langsung tidak berlaku begitu server database menggantinya, biasanya dalam beberapa detik.',
	dialogApps:
		'Sampai di-redeploy dengan password baru, aplikasi yang terpasang tidak bisa membuka koneksi baru ke database:',
	dialogNoProjects: 'Database ini belum dipasang ke proyek, jadi tidak ada aplikasi yang terputus.',
	autoRedeploy: 'Redeploy otomatis proyek yang terpasang',
	autoRedeployHint:
		'Begitu password baru aktif, Sakala men-deploy ulang versi yang sedang live di setiap proyek.',
	manualRedeploy:
		'Tanpa redeploy otomatis, kamu perlu redeploy setiap proyek sendiri. Sampai itu, aplikasinya tidak bisa terhubung ke database.',
	requested: 'Penggantian password diminta.',
	pending:
		'Server database sedang mengganti password. Password lama berhenti berlaku saat itu juga.',
	queueing: 'Menyiapkan redeploy proyek yang terpasang...',
	failedPrefix: 'Penggantian password terakhir gagal, jadi password lama masih berlaku.',
	rowQueued: 'Redeploy otomatis berjalan',
	rowDone: 'Sudah memakai password baru',
	rowFirstDeploy: 'Belum di-deploy. Deploy pertamanya memakai password baru.',
	rowNeedsRedeploy: 'Masih memakai password lama, jadi belum bisa terhubung',
	viewDeployment: 'Lihat deployment',
	redeploy: 'Redeploy',
	redeploying: 'Menjalankan...',
	redeployFailed: 'Redeploy belum bisa dijalankan. Silakan coba lagi.'
} as const;

/** Why the API queued no redeploy for a project, in words; `no_active_deployment` has its own row. */
const SKIPPED_REASONS: Record<string, string> = {
	requester_cannot_deploy:
		'Redeploy otomatis dilewati karena akun yang mengganti password tidak lagi bisa men-deploy proyek ini.',
	legal_acceptance_required:
		'Redeploy otomatis dilewati karena syarat layanan terbaru belum disetujui.',
	project_suspended: 'Redeploy otomatis dilewati karena proyek ini ditangguhkan.',
	active_deployment_limit:
		'Redeploy otomatis dilewati karena masih ada deployment yang berjalan. Redeploy lagi setelah selesai.',
	active_container_limit:
		'Redeploy otomatis dilewati karena batas aplikasi aktif workspace sudah penuh.',
	build_rate_limit: 'Redeploy otomatis dilewati karena batas build per jam sudah tercapai.',
	repository_access_revoked:
		'Redeploy otomatis dilewati karena akses ke repository GitHub-nya sudah dicabut.',
	database_endpoint_unavailable:
		'Redeploy otomatis dilewati karena server database belum melaporkan alamatnya.',
	release_command_unsupported:
		'Redeploy otomatis dilewati karena servernya belum bisa menjalankan release command.'
};

const SKIPPED_FALLBACK = 'Redeploy otomatis belum bisa dijalankan untuk proyek ini.';

export const NO_ACTIVE_DEPLOYMENT = 'no_active_deployment';

const clockFormat = new Intl.DateTimeFormat('id-ID', {
	hour: '2-digit',
	minute: '2-digit',
	hourCycle: 'h23'
});
const dayFormat = new Intl.DateTimeFormat('id-ID', {
	day: 'numeric',
	month: 'short',
	year: 'numeric'
});

/** `Password sudah diganti pukul 16.02`, with the date for another day. */
export function rotationCompletedText(completedAt: string, now: Date = new Date()): string {
	const time = new Date(completedAt);
	const clock = clockFormat.format(time);
	return time.toDateString() === now.toDateString()
		? `Password sudah diganti pukul ${clock}.`
		: `Password terakhir diganti ${dayFormat.format(time)} pukul ${clock}.`;
}

export type RotationView =
	| { state: 'pending' }
	| { state: 'failed'; summary: string | null }
	| {
			state: 'completed';
			completedText: string;
			/** The redeploys were asked for and are being queued. */
			queueing: boolean;
			/** Per attached project, the API's outcome; empty when no redeploys were asked for. */
			redeploys: Map<string, DatabaseRotationRedeploy>;
			redeployAttached: boolean;
	  }
	| null;

/** What the "Ganti password" section says about the newest rotation. */
export function rotationView(
	database: Pick<Database, 'password_rotation' | 'last_failure'>,
	now: Date = new Date()
): RotationView {
	const rotation = database.password_rotation;
	if (!rotation) return null;
	if (rotation.status === 'pending') return { state: 'pending' };
	if (rotation.status === 'failed') {
		return { state: 'failed', summary: rotationFailure(database)?.summary ?? null };
	}
	if (rotation.status !== 'completed' || !rotation.completed_at) return null;
	return {
		state: 'completed',
		completedText: rotationCompletedText(rotation.completed_at, now),
		queueing: rotation.redeploy_attached && rotation.redeploys === null,
		redeploys: new Map((rotation.redeploys ?? []).map((item) => [item.project_id, item])),
		redeployAttached: rotation.redeploy_attached
	};
}

/** What the project needs after the rotation, from the API's outcome and the project as it is now. */
export type RotationProjectState =
	| { kind: 'queued'; deploymentId: string }
	| { kind: 'done' }
	| { kind: 'first_deploy' }
	| { kind: 'needs_redeploy'; reason: string | null }
	| { kind: 'loading' };

export function rotationProjectState(
	redeploy: DatabaseRotationRedeploy | undefined,
	project: { active_deployment_id: string | null; redeploy_required: boolean } | undefined
): RotationProjectState {
	if (redeploy?.deployment_id) {
		// Once the queued deployment serves, the project runs with the new password.
		return project?.active_deployment_id === redeploy.deployment_id
			? { kind: 'done' }
			: { kind: 'queued', deploymentId: redeploy.deployment_id };
	}
	if (redeploy?.skipped_reason === NO_ACTIVE_DEPLOYMENT) return { kind: 'first_deploy' };
	if (!project) return { kind: 'loading' };
	if (!project.active_deployment_id) return { kind: 'first_deploy' };
	if (!project.redeploy_required) return { kind: 'done' };
	const skipped = redeploy?.skipped_reason;
	return {
		kind: 'needs_redeploy',
		reason: skipped ? (SKIPPED_REASONS[skipped] ?? SKIPPED_FALLBACK) : null
	};
}

/* ---------- Errors ---------- */

export type DatabaseAction =
	| 'create'
	| 'rename'
	| 'delete'
	| 'attach'
	| 'detach'
	| 'credentials'
	| 'rotate'
	| 'extension'
	| 'load';

const FORBIDDEN: Record<DatabaseAction, string> = {
	create: 'Hanya pemilik dan anggota workspace yang bisa membuat database.',
	rename: 'Hanya pemilik dan anggota workspace yang bisa mengganti nama database.',
	delete: 'Hanya pemilik dan anggota workspace yang bisa menghapus database.',
	attach: 'Hanya pemilik dan anggota workspace yang bisa memasang database ke proyek.',
	detach: 'Hanya pemilik dan anggota workspace yang bisa melepas database dari proyek.',
	credentials: 'Password dan DATABASE_URL hanya bisa dilihat pemilik workspace.',
	rotate: 'Hanya pemilik dan anggota workspace yang bisa mengganti password database.',
	extension: 'Hanya pemilik dan anggota workspace yang bisa memasang extension.',
	load: 'Kamu tidak punya akses ke database di workspace ini.'
};

const NOT_FOUND: Partial<Record<DatabaseAction, string>> = {
	detach: 'Database ini sudah tidak terpasang ke proyek itu. Daftar proyeknya sudah diperbarui.',
	load: 'Database ini tidak ada di workspace ini. Mungkin sudah dihapus.'
};

/**
 * Copy for a refused database request. Quota and region refusals are rebuilt from their fields so
 * the numbers read like the rest of the page; the other codes carry the API's own Indonesian text,
 * which already names the project or database involved.
 */
export function databaseErrorMessage(
	error: unknown,
	action: DatabaseAction,
	fallback: string
): string {
	if (!(error instanceof ApiError)) return getErrorMessage(error, fallback);

	switch (error.code) {
		case DATABASE_ERROR_CODES.limitExceeded: {
			const details = parseDatabaseRefusal('DATABASE_LIMIT_EXCEEDED', error.details);
			if (details?.limit === 0) return QUOTA_COPY.disabled;
			return details ? QUOTA_COPY.countFull(details.limit) : error.message;
		}
		case DATABASE_ERROR_CODES.storageLimitExceeded: {
			const details = parseDatabaseRefusal('DATABASE_STORAGE_LIMIT_EXCEEDED', error.details);
			if (!details) return error.message;
			const meter = storageMeter(details.current_bytes, details.limit_mb);
			return `Penyimpanan database workspace ini sudah penuh (${meter.label}), jadi database baru akan langsung terkunci. Hapus database yang tidak dipakai, atau minta admin Sakala menaikkan kuota.`;
		}
		case DATABASE_ERROR_CODES.regionUnavailable: {
			const details = parseDatabaseRefusal('DATABASE_REGION_UNAVAILABLE', error.details);
			if (details?.region) {
				return `Belum ada server database di region ${details.region}. Pilih region lain, atau pilih ${DATABASE_COPY.regionAuto}.`;
			}
			return 'Belum ada server database yang bisa menerima database baru. Coba lagi nanti, atau hubungi operator Sakala.';
		}
	}

	if (error.isForbidden) return FORBIDDEN[action];
	if (error.status === 404) {
		return (
			NOT_FOUND[action] ?? 'Database ini sudah tidak ada. Mungkin baru saja dihapus orang lain.'
		);
	}
	return getErrorMessage(error, fallback);
}

/* ---------- Redeploy after a change ---------- */

/**
 * Attaching and detaching reach an app only on its next deployment, because the API builds the
 * connection variables when the deployment is created. A new password has its own section, driven
 * by `password_rotation`.
 */
export type RedeployNotice = {
	projectId: string;
	projectName: string;
	kind: 'attached' | 'detached';
	/** From the attach answer; unknown for the others. */
	redeployRequired?: boolean;
};

export function redeployNoticeText(notice: RedeployNotice): string {
	switch (notice.kind) {
		case 'attached':
			return notice.redeployRequired === false
				? `${notice.projectName} menerima variabel koneksinya saat deploy berikutnya.`
				: `Redeploy ${notice.projectName} supaya aplikasinya menerima variabel koneksi database ini.`;
		case 'detached':
			return `Redeploy ${notice.projectName} supaya aplikasinya berhenti memakai database ini. Datanya tetap ada.`;
	}
}

/** Notices keyed by project: a newer change to the same project replaces the older one. */
export function addRedeployNotices(
	current: readonly RedeployNotice[],
	added: readonly RedeployNotice[]
): RedeployNotice[] {
	const replaced = new Set(added.map((notice) => notice.projectId));
	return [...current.filter((notice) => !replaced.has(notice.projectId)), ...added];
}

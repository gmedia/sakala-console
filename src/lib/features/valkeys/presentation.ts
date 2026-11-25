import { ApiError, VALKEY_ERROR_CODES, getErrorMessage } from '$lib/api/errors';
import { parseValkeyRefusal } from '$lib/api/resources/valkey-refusals';
import {
	VALKEY_COMMANDS,
	VALKEY_MODES,
	type KnownValkeyStatus,
	type Valkey,
	type ValkeyMode,
	type ValkeyRotationRedeploy
} from '$lib/api/resources/valkeys';
import type { PilotLimits } from '$lib/api/resources/pilot-limits';
import type { BadgeTone } from '$lib/components/ui/Badge.svelte';
import {
	ATTACHED_REDEPLOY_SKIPPED_REASONS,
	BYTES_PER_MB,
	STORAGE_WARNING_RATIO,
	formatMegabytes,
	rotationCompletedText,
	storageMeter,
	type RotationRowCopy,
	type StorageMeter
} from '$lib/features/databases/presentation';
import { VALKEY_VARIABLES } from './variables';

export { BYTES_PER_MB, formatMegabytes };
export { VALKEY_VARIABLES } from './variables';

/**
 * At this share of `maxmemory` the API notifies the workspace ("Valkey hampir penuh"), the same
 * ratio as database and bucket storage.
 */
export const VALKEY_WARNING_RATIO = STORAGE_WARNING_RATIO;

/** While a store is created, resized, or deleted the node reports back within seconds. */
export const VALKEY_TRANSITION_POLL_MS = 5_000;

/** A password rotation usually completes in seconds, and the redeploys are queued right after. */
export const PASSWORD_ROTATION_POLL_MS = 2_000;

/** Longest display name the API accepts (StoreValkeyRequest `max:100`). */
export const VALKEY_NAME_MAX_LENGTH = 100;

/**
 * The sizes v1 offers and the one a store gets without asking (ManagedValkey::SIZES_MB and
 * DEFAULT_SIZE_MB). `pilot-limits` sends them as `valkeys.sizes_mb` and `default_size_mb`; these are
 * the fallback while it loads.
 */
export const VALKEY_SIZES_MB = [32, 64, 128] as const;
export const VALKEY_DEFAULT_SIZE_MB = 64;

/** The mode a new store starts with: a queue or a session must not lose its data. */
export const RECOMMENDED_VALKEY_MODE: ValkeyMode = 'persistent';

export const VALKEY_COPY = {
	nav: 'Valkey',
	create: 'Buat Valkey',
	creating: 'Membuat...',
	createForProject: 'Buat Valkey untuk proyek ini',
	/** One line for people who know Redis but not Valkey (Jakob's Law). */
	whatIs:
		'Valkey adalah penyimpanan key-value di memori yang kompatibel dengan Redis, jadi driver redis di Laravel dan library seperti ioredis atau BullMQ bisa langsung memakainya.',
	nameHint: 'Hanya untuk ditampilkan di Sakala, misalnya nama aplikasi yang memakainya.',
	privateNote:
		'Valkey hanya bisa dijangkau dari proyek yang terpasang, lewat network privat di server yang sama. Tidak ada alamat publik.',
	credentialsAudit: 'Setiap kali password ditampilkan, Sakala mencatatnya di log audit workspace.',
	credentialsOwnerOnly:
		'Password hanya bisa dilihat pemilik workspace. Proyek yang terpasang menerimanya otomatis saat deploy.',
	credentialsNotReady: 'Detail koneksi tersedia setelah Valkey siap.',
	reveal: 'Tampilkan password',
	envBlockTitle: 'Variabel yang diterima proyek',
	envBlockCopy: 'Salin semua',
	envBlockNote:
		'Proyek yang terpasang sudah menerimanya otomatis. Alamat ini hanya bisa dijangkau dari proyek itu, jadi tidak bisa dipakai dari laptop.',
	notMeasured: 'Belum diukur',
	noProjects: 'Belum dipasang ke proyek',
	redeployLink: 'Buka proyek untuk redeploy',
	viewerNote: 'Kamu pengamat di workspace ini, jadi hanya bisa melihat Valkey-nya.',
	unavailableTitle: 'Valkey belum bisa dibuat di server ini',
	unavailableBody:
		'Belum ada server yang bisa menjalankan Valkey baru saat ini. Valkey yang sudah ada tetap berjalan.',
	disabledTitle: 'Valkey belum tersedia',
	disabledBody: 'Instalasi Sakala ini belum mengaktifkan Valkey terkelola.',
	noQuota: 'Workspace ini belum bisa membuat Valkey',
	noQuotaBody:
		'Valkey terkelola masih dibuka bertahap per workspace, karena memorinya terpakai terus selama Valkey ada. Minta admin Sakala mengaktifkannya lewat profil batas workspace.',
	regionAuto: 'Otomatis',
	regionHint:
		'Valkey hanya bisa dipakai proyek yang berjalan di server yang sama, jadi pilih region tempat proyeknya berjalan.'
} as const;

/* ---------- Feature availability (progressive disclosure) ---------- */

type ValkeyLimitFields = {
	quotas?: Partial<
		Pick<
			PilotLimits['quotas'],
			'max_valkeys' | 'current_valkeys_count' | 'max_valkey_memory_mb' | 'current_valkey_memory_mb'
		>
	>;
	valkeys?: { enabled: boolean; available: boolean; sizes_mb: number[]; default_size_mb: number };
};

/**
 * Whether this installation runs managed Valkey at all (`SAKALA_VALKEY_ENABLED`). Unknown, while the
 * limits load or from an older API, is "no": the Console then shows nothing of Valkey.
 */
export function valkeysEnabled(limits: ValkeyLimitFields | undefined): boolean {
	return limits?.valkeys?.enabled === true;
}

/**
 * Whether the workspace has anything to do with Valkey: the installation runs it, and the workspace
 * may create a store or already holds one. Everyone else never sees a Valkey entry.
 */
export function valkeysInUse(limits: ValkeyLimitFields | undefined): boolean {
	if (!valkeysEnabled(limits)) return false;
	return (limits?.quotas?.max_valkeys ?? 0) > 0 || (limits?.quotas?.current_valkeys_count ?? 0) > 0;
}

/** On, but no node takes a new store now (`valkeys.available` false). */
export function valkeysUnavailable(limits: ValkeyLimitFields | undefined): boolean {
	return valkeysEnabled(limits) && limits?.valkeys?.available === false;
}

/** The sizes to offer, smallest first, from the server or the v1 fallback. */
export function valkeySizes(limits: ValkeyLimitFields | undefined): number[] {
	const sizes = limits?.valkeys?.sizes_mb;
	return [...(sizes && sizes.length > 0 ? sizes : VALKEY_SIZES_MB)].sort((a, b) => a - b);
}

export function defaultValkeySize(limits: ValkeyLimitFields | undefined): number {
	return limits?.valkeys?.default_size_mb ?? VALKEY_DEFAULT_SIZE_MB;
}

/** MB the workspace may still reserve, or `null` for an API without the fields. */
export function remainingValkeyMemoryMb(limits: ValkeyLimitFields | undefined): number | null {
	const max = limits?.quotas?.max_valkey_memory_mb;
	const current = limits?.quotas?.current_valkey_memory_mb;
	if (max === undefined || current === undefined) return null;
	return Math.max(max - current, 0);
}

/**
 * Whether a project page may offer to create a store for it: a node takes stores, and the
 * workspace has a store and the smallest size left.
 */
export function canOfferProjectValkey(limits: ValkeyLimitFields | undefined): boolean {
	if (!valkeysEnabled(limits) || !limits?.valkeys?.available) return false;
	const max = limits.quotas?.max_valkeys ?? 0;
	const used = limits.quotas?.current_valkeys_count ?? 0;
	const remaining = remainingValkeyMemoryMb(limits) ?? 0;
	return max > used && remaining >= Math.min(...valkeySizes(limits));
}

/* ---------- Mode ---------- */

export type ValkeyModeView = {
	label: string;
	/** What happens to the data, in one sentence. */
	summary: string;
	/** What it suits, with examples a Laravel or Node developer recognises. */
	useFor: string;
	/** What happens when it is full. */
	whenFull: string;
};

export const MODE_VIEWS: Record<ValkeyMode, ValkeyModeView> = {
	persistent: {
		label: 'Persisten',
		summary:
			'Data ditulis ke disk setiap detik dan di-backup setiap malam, jadi tetap ada setelah restart.',
		useFor: 'Untuk antrean job (Laravel queue, BullMQ) dan sesi login.',
		whenFull: 'Saat penuh, tulisan baru ditolak sampai ada data yang dihapus.'
	},
	cache: {
		label: 'Cache',
		summary: 'Data hanya di memori dan bisa kosong saat Valkey restart. Tidak di-backup.',
		useFor: 'Untuk cache yang bisa dibuat ulang, misalnya hasil query atau halaman.',
		whenFull: 'Saat penuh, key yang paling lama tidak dipakai dibuang otomatis.'
	}
};

export const MODE_FIXED_NOTE = 'Mode tidak bisa diubah setelah Valkey dibuat.';
export const MODE_RECOMMENDED_LABEL = 'Disarankan';

function isKnownMode(mode: string): mode is ValkeyMode {
	return (VALKEY_MODES as readonly string[]).includes(mode);
}

/** A mode from a newer API still shows as itself. */
export function valkeyModeView(mode: string): ValkeyModeView {
	return isKnownMode(mode)
		? MODE_VIEWS[mode]
		: { label: mode, summary: '', useFor: '', whenFull: '' };
}

/* ---------- Status ---------- */

export type ValkeyStatusView = {
	label: string;
	tone: BadgeTone;
	/** What the status means for the apps that use it, and what to do about it. */
	description: string;
	/** The node is working on it; the page polls until it settles. */
	transitional: boolean;
};

const STATUS_VIEWS: Record<KnownValkeyStatus, Omit<ValkeyStatusView, 'description'>> = {
	provisioning: { label: 'Menyiapkan', tone: 'running', transitional: true },
	ready: { label: 'Siap', tone: 'success', transitional: false },
	failed: { label: 'Gagal', tone: 'error', transitional: false },
	deleting: { label: 'Menghapus', tone: 'queued', transitional: true },
	locked: { label: 'Dikunci', tone: 'warning', transitional: false }
};

export const LOCKED_COPY = {
	persistent:
		'Valkey ini dikunci, jadi aplikasi tidak bisa login ke Valkey dan menerima error autentikasi. Datanya tetap ada dan backup tetap berjalan.',
	cache:
		'Valkey ini dikunci, jadi aplikasi tidak bisa login ke Valkey dan menerima error autentikasi. Isinya tetap ada selama Valkey tidak restart.',
	why: 'Valkey dikunci kalau semua proyek yang memakainya sedang ditangguhkan, dan terbuka lagi sendiri saat salah satunya aktif kembali. Admin Sakala juga bisa menguncinya karena penyalahgunaan; untuk itu, hubungi admin.'
} as const;

const STATUS_DESCRIPTIONS: Record<Exclude<KnownValkeyStatus, 'locked'>, string> = {
	provisioning: 'Server sedang membuat Valkey ini. Halaman ini memperbarui sendiri begitu siap.',
	ready: 'Berjalan. Proyek yang terpasang menjangkaunya sejak deploy berikutnya setelah dipasang.',
	failed: 'Valkey ini gagal dibuat, jadi tidak bisa dipakai. Hapus lalu buat Valkey baru.',
	deleting: 'Server sedang menghapus Valkey ini beserta isinya.'
};

function isKnownStatus(status: string): status is KnownValkeyStatus {
	return status in STATUS_VIEWS;
}

/** The label, tone, and meaning of a status. A status from a newer API still shows as itself. */
export function valkeyStatusView(
	valkey: Pick<Valkey, 'status' | 'last_failure'> & Partial<Pick<Valkey, 'mode'>>
): ValkeyStatusView {
	if (!isKnownStatus(valkey.status)) {
		return {
			label: valkey.status,
			tone: 'neutral',
			description:
				'Status ini belum dikenal Console. Muat ulang halaman untuk melihat yang terbaru.',
			transitional: false
		};
	}
	const view = STATUS_VIEWS[valkey.status];
	const failure = valkey.last_failure;
	let description: string;
	if (valkey.status === 'locked') {
		description = valkey.mode === 'cache' ? LOCKED_COPY.cache : LOCKED_COPY.persistent;
	} else if (valkey.status === 'failed' && failure?.command === VALKEY_COMMANDS.create) {
		description = `${failure.summary} Hapus Valkey ini lalu buat lagi.`;
	} else {
		description = STATUS_DESCRIPTIONS[valkey.status];
	}
	return { ...view, description };
}

const ROW_NOTES: Partial<Record<KnownValkeyStatus, string>> = {
	provisioning: 'Sedang dibuat di server',
	failed: 'Gagal dibuat. Hapus lalu buat lagi.',
	deleting: 'Sedang dihapus beserta isinya',
	locked: 'Dikunci, jadi aplikasi tidak bisa login'
};

/** One line under a list row's name, for the statuses that need one. */
export function valkeyRowNote(valkey: Pick<Valkey, 'status'>): string | null {
	return isKnownStatus(valkey.status) ? (ROW_NOTES[valkey.status] ?? null) : null;
}

export function regionText(region: string | null): string {
	return region ?? VALKEY_COPY.regionAuto;
}

export function isTransitional(valkey: Pick<Valkey, 'status'>): boolean {
	return isKnownStatus(valkey.status) && STATUS_VIEWS[valkey.status].transitional;
}

/** `ready` and `locked` run on the node: they have a connection, credentials, and a size to change. */
export function isOnNode(valkey: Pick<Valkey, 'status'>): boolean {
	return valkey.status === 'ready' || valkey.status === 'locked';
}

/* ---------- Memory ---------- */

export const MEMORY_COPY = {
	nearlyFull: {
		persistent:
			'Hampir penuh. Saat penuh, tulisan baru ditolak, termasuk job antrean baru. Hapus data yang tidak dipakai, atau perbesar ukurannya.',
		cache:
			'Hampir penuh. Itu wajar untuk cache: saat penuh, key yang paling lama tidak dipakai dibuang.'
	},
	full: {
		persistent:
			'Penuh. Tulisan baru ditolak, termasuk job antrean baru, sampai ada data yang dihapus atau ukurannya diperbesar.',
		cache:
			'Penuh. Valkey membuang key yang paling lama tidak dipakai untuk memberi tempat key baru.'
	}
} as const;

/**
 * Used memory against `maxmemory`. A full cache store evicts by design, so it never shows as an
 * error: its bar stops at "hampir penuh".
 */
export function valkeyMemoryMeter(
	valkey: Pick<Valkey, 'usage' | 'maxmemory_mb' | 'mode'>
): StorageMeter {
	const meter = storageMeter(valkey.usage.used_memory_bytes, valkey.maxmemory_mb);
	const percent = Math.round(meter.ratio * 100);
	return {
		...meter,
		level: valkey.mode === 'cache' && meter.level === 'full' ? 'warning' : meter.level,
		accessibleLabel:
			valkey.usage.used_memory_bytes == null
				? `${meter.label}, pemakaiannya belum diukur`
				: `${meter.label}, ${percent}% dari ukuran Valkey`
	};
}

/** The memory warning for the overview, or `null` below 80 % or before the node reported. */
export function valkeyMemoryNotice(
	valkey: Pick<Valkey, 'usage' | 'maxmemory_mb' | 'mode' | 'status'>
): { level: 'warning' | 'full'; text: string } | null {
	if (!isOnNode(valkey) || valkey.usage.used_memory_bytes == null) return null;
	const used = valkey.usage.used_memory_bytes;
	const capacity = valkey.maxmemory_mb * BYTES_PER_MB;
	const mode: ValkeyMode = valkey.mode === 'cache' ? 'cache' : 'persistent';
	if (used >= capacity) {
		return { level: mode === 'cache' ? 'warning' : 'full', text: MEMORY_COPY.full[mode] };
	}
	if (used >= capacity * VALKEY_WARNING_RATIO) {
		return { level: 'warning', text: MEMORY_COPY.nearlyFull[mode] };
	}
	return null;
}

/** A resize on its way, in words. */
export function pendingResizeText(valkey: Pick<Valkey, 'pending_maxmemory_mb'>): string | null {
	return valkey.pending_maxmemory_mb === null
		? null
		: `Ukuran sedang diubah menjadi ${formatMegabytes(valkey.pending_maxmemory_mb)}. Server menerapkannya dalam beberapa detik.`;
}

/** A failed resize keeps the old size, and `last_failure` says why. */
export function resizeFailure(valkey: Pick<Valkey, 'last_failure'>) {
	return valkey.last_failure?.command === VALKEY_COMMANDS.resize ? valkey.last_failure : null;
}

/* ---------- Workspace quota ---------- */

const countFormat = new Intl.NumberFormat('id-ID');

export const QUOTA_COPY = {
	disabled:
		'Workspace ini belum bisa membuat Valkey. Minta admin Sakala mengaktifkannya lewat profil batas workspace.',
	countFull: (max: number) =>
		`Workspace ini sudah memakai ${countFormat.format(max)} dari ${countFormat.format(max)} Valkey. Hapus Valkey yang tidak dipakai, atau minta admin Sakala menaikkan batasnya.`,
	memoryFull:
		'Jatah memori Valkey workspace ini sudah habis dicadangkan. Kecilkan atau hapus Valkey lain, atau minta admin Sakala menaikkan jatahnya.',
	reservedHint:
		'Ukuran Valkey dicadangkan dari jatah ini sejak dibuat, berapa pun isinya, karena memorinya terpakai terus.'
} as const;

export type ValkeyQuota = {
	count: { used: number; max: number; label: string; full: boolean };
	/** Sizes reserved against the workspace's Valkey memory: `dicadangkan 96 MB dari 160 MB`. */
	memory: StorageMeter;
	remainingMb: number;
	/** Why a new store would be refused now, or `null` when it would not. */
	blockedReason: string | null;
};

type QuotaFields = Pick<
	PilotLimits['quotas'],
	'max_valkeys' | 'current_valkeys_count' | 'max_valkey_memory_mb' | 'current_valkey_memory_mb'
>;

/** The workspace's store count and reserved memory, or `null` for an API without them. */
export function valkeyQuota(
	quotas: Partial<QuotaFields> | undefined,
	smallestSizeMb: number = VALKEY_SIZES_MB[0]
): ValkeyQuota | null {
	if (
		quotas?.max_valkeys === undefined ||
		quotas.current_valkeys_count === undefined ||
		quotas.max_valkey_memory_mb === undefined ||
		quotas.current_valkey_memory_mb === undefined
	) {
		return null;
	}
	const max = quotas.max_valkeys;
	const used = quotas.current_valkeys_count;
	const reservedMb = quotas.current_valkey_memory_mb;
	const limitMb = quotas.max_valkey_memory_mb;
	const meter = storageMeter(reservedMb * BYTES_PER_MB, limitMb);
	const remainingMb = Math.max(limitMb - reservedMb, 0);
	const countFull = used >= max;

	let blockedReason: string | null = null;
	if (max === 0 || limitMb === 0) blockedReason = QUOTA_COPY.disabled;
	else if (countFull) blockedReason = QUOTA_COPY.countFull(max);
	else if (remainingMb < smallestSizeMb) blockedReason = QUOTA_COPY.memoryFull;

	return {
		count: {
			used,
			max,
			label: `${countFormat.format(used)} dari ${countFormat.format(max)} Valkey`,
			full: countFull
		},
		memory: {
			...meter,
			label: `dicadangkan ${meter.label}`,
			accessibleLabel: `Dicadangkan ${formatMegabytes(reservedMb)} dari ${formatMegabytes(limitMb)}`
		},
		remainingMb,
		blockedReason
	};
}

export type SizeOption = { mb: number; label: string; disabled: boolean; reason: string | null };

/**
 * The sizes for a new store or a resize. A size past what the workspace may still reserve is
 * disabled with the reason; `availableMb` is `null` when the API decides (admins). For a resize,
 * pass the store's own size in `ownMb`: it is part of what the store may grow into.
 */
export function sizeOptions(
	sizes: readonly number[],
	availableMb: number | null,
	ownMb = 0
): SizeOption[] {
	return sizes.map((mb) => {
		const fits = availableMb === null || mb <= availableMb + ownMb;
		return {
			mb,
			label: formatMegabytes(mb),
			disabled: !fits,
			reason: fits
				? null
				: `Melebihi sisa jatah memori workspace (${formatMegabytes(availableMb ?? 0)}).`
		};
	});
}

/* ---------- Password rotation ---------- */

export const PASSWORD_ROTATION_COPY = {
	title: 'Ganti password',
	lead: 'Buat password baru kalau yang lama mungkin bocor.',
	action: 'Ganti password',
	dialogTitle: 'Ganti password Valkey?',
	dialogConfirm: 'Ganti password',
	dialogBusy: 'Meminta...',
	rotateBody:
		'Password lama langsung berhenti berlaku dan semua koneksi yang sedang terbuka diputus. Aplikasi yang sedang berjalan baru bisa memakai Valkey lagi setelah di-redeploy, karena password dibaca saat deploy.',
	dialogApps: 'Proyek yang terpasang:',
	dialogNoProjects: 'Valkey ini belum dipasang ke proyek, jadi tidak ada aplikasi yang terputus.',
	autoRedeploy: 'Redeploy otomatis proyek yang terpasang',
	autoRedeployHint:
		'Begitu password baru aktif, Sakala men-deploy ulang versi yang sedang live di setiap proyek, dengan image yang sama tanpa build.',
	manualRedeploy:
		'Tanpa redeploy otomatis, kamu perlu redeploy setiap proyek sendiri. Sampai itu, aplikasinya tidak bisa memakai Valkey.',
	requested: 'Penggantian password diminta.',
	pending:
		'Server sedang mengganti password. Password lama berhenti berlaku dan koneksinya diputus saat itu juga.',
	queueing: 'Menyiapkan redeploy proyek yang terpasang...',
	failedPrefix: 'Penggantian password terakhir gagal, jadi password lama masih berlaku.',
	unknown:
		'Server tidak bisa memastikan password mana yang berlaku, karena Valkey tidak menjawab saat diganti. Selama belum pasti, deploy proyek yang terpasang dan Tampilkan password ditolak. Ganti password sekali lagi untuk membereskannya.',
	unknownReveal:
		'Password belum bisa ditampilkan karena belum pasti mana yang berlaku. Penjelasannya ada di bagian Ganti password di bawah.',
	unknownNoAccess:
		'Server tidak bisa memastikan password mana yang berlaku, jadi deploy proyek yang terpasang ditolak sampai pemilik atau anggota workspace mengganti password sekali lagi.',
	completed: (completedAt: string, now?: Date) =>
		rotationCompletedText(completedAt, now, 'Password')
} as const;

export const PASSWORD_ROTATION_ROW_COPY: RotationRowCopy = {
	rowQueued: 'Redeploy otomatis berjalan',
	rowDone: 'Sudah memakai password baru',
	rowFirstDeploy: 'Belum di-deploy. Deploy pertamanya memakai password baru.',
	rowNeedsRedeploy: 'Masih memakai password lama, jadi belum bisa memakai Valkey',
	viewDeployment: 'Lihat deployment',
	redeploy: 'Redeploy',
	redeploying: 'Menjalankan...',
	redeployFailed: 'Redeploy belum bisa dijalankan. Muat ulang halaman, lalu tekan Redeploy lagi.'
};

/** The shared reasons, with the requester's in the words of a Valkey password rotation. */
export const PASSWORD_ROTATION_SKIPPED_REASONS: Record<string, string> = {
	...ATTACHED_REDEPLOY_SKIPPED_REASONS,
	requester_cannot_deploy:
		'Redeploy otomatis dilewati karena akun yang mengganti password Valkey tidak lagi bisa men-deploy proyek ini.'
};

export function passwordRotationFailure(valkey: Pick<Valkey, 'last_failure'>) {
	return valkey.last_failure?.command === VALKEY_COMMANDS.rotatePassword
		? valkey.last_failure
		: null;
}

/** The newest rotation is not settled: the node has not reported, or redeploys are being queued. */
export function isPasswordRotationSettling(
	valkey: Partial<Pick<Valkey, 'password_rotation'>>
): boolean {
	const rotation = valkey.password_rotation;
	if (!rotation) return false;
	if (rotation.status === 'pending') return true;
	return (
		rotation.status === 'completed' && rotation.redeploy_attached && rotation.redeploys === null
	);
}

/** Neither password is known to work; the API refuses credentials and deploys until a new rotation. */
export function isPasswordUnknown(valkey: Partial<Pick<Valkey, 'password_rotation'>>): boolean {
	return valkey.password_rotation?.status === 'unknown';
}

export type PasswordRotationView =
	| { state: 'pending' }
	| { state: 'failed'; summary: string | null }
	| { state: 'unknown' }
	| {
			state: 'completed';
			completedText: string;
			queueing: boolean;
			redeploys: Map<string, ValkeyRotationRedeploy>;
			redeployAttached: boolean;
	  }
	| null;

export function passwordRotationView(
	valkey: Pick<Valkey, 'password_rotation' | 'last_failure'>,
	now: Date = new Date()
): PasswordRotationView {
	const rotation = valkey.password_rotation;
	if (!rotation) return null;
	if (rotation.status === 'pending') return { state: 'pending' };
	if (rotation.status === 'unknown') return { state: 'unknown' };
	if (rotation.status === 'failed') {
		return { state: 'failed', summary: passwordRotationFailure(valkey)?.summary ?? null };
	}
	if (rotation.status !== 'completed' || !rotation.completed_at) return null;
	return {
		state: 'completed',
		completedText: PASSWORD_ROTATION_COPY.completed(rotation.completed_at, now),
		queueing: rotation.redeploy_attached && rotation.redeploys === null,
		redeploys: new Map((rotation.redeploys ?? []).map((item) => [item.project_id, item])),
		redeployAttached: rotation.redeploy_attached
	};
}

/** Poll while a rotation settles or the node creates, resizes, or deletes a store. */
export function resolveValkeyPollInterval(
	valkeys:
		| readonly (Pick<Valkey, 'status'> &
				Partial<Pick<Valkey, 'password_rotation' | 'pending_maxmemory_mb'>>)[]
		| undefined
): number | false {
	if (valkeys?.some(isPasswordRotationSettling)) return PASSWORD_ROTATION_POLL_MS;
	return valkeys?.some(
		(valkey) => isTransitional(valkey) || (valkey.pending_maxmemory_mb ?? null) !== null
	)
		? VALKEY_TRANSITION_POLL_MS
		: false;
}

export type ProvisioningStep = { label: string; state: 'done' | 'current' | 'pending' };

/** The steps of a creation, from what the API can tell; it gives no percentage. */
export function provisioningSteps(valkey: Pick<Valkey, 'status'>): ProvisioningStep[] {
	const ready = valkey.status !== 'provisioning';
	return [
		{ label: 'Permintaan diterima', state: 'done' },
		{ label: 'Server membuat Valkey', state: ready ? 'done' : 'current' },
		{ label: 'Siap dipakai', state: ready ? 'done' : 'pending' }
	];
}

/**
 * The failure to show beside the status, when it is not the status's own explanation or the
 * rotation section's.
 */
export function separateFailure(valkey: Pick<Valkey, 'status' | 'last_failure'>) {
	const failure = valkey.last_failure;
	if (!failure) return null;
	if (valkey.status === 'failed' && failure.command === VALKEY_COMMANDS.create) return null;
	if (failure.command === VALKEY_COMMANDS.rotatePassword) return null;
	return failure;
}

/* ---------- Variables ---------- */

/** The variables, in the API's order, then any name a newer API adds. */
export function valkeyEnvBlock(variables: Record<string, string>): string {
	const known: readonly string[] = VALKEY_VARIABLES;
	const names = [
		...known.filter((name) => name in variables),
		...Object.keys(variables).filter((name) => !known.includes(name))
	];
	return names.map((name) => `${name}=${variables[name]}`).join('\n');
}

/* ---------- Errors ---------- */

export type ValkeyAction =
	| 'create'
	| 'rename'
	| 'resize'
	| 'delete'
	| 'attach'
	| 'detach'
	| 'credentials'
	| 'rotate'
	| 'load';

const FORBIDDEN: Record<ValkeyAction, string> = {
	create: 'Hanya pemilik dan anggota workspace yang bisa membuat Valkey.',
	rename: 'Hanya pemilik dan anggota workspace yang bisa mengganti nama Valkey.',
	resize: 'Hanya pemilik dan anggota workspace yang bisa mengubah ukuran Valkey.',
	delete: 'Hanya pemilik dan anggota workspace yang bisa menghapus Valkey.',
	attach: 'Hanya pemilik dan anggota workspace yang bisa memasang Valkey ke proyek.',
	detach: 'Hanya pemilik dan anggota workspace yang bisa melepas Valkey dari proyek.',
	credentials: 'Password hanya bisa dilihat pemilik workspace.',
	rotate: 'Hanya pemilik dan anggota workspace yang bisa mengganti password Valkey.',
	load: 'Kamu tidak punya akses ke Valkey di workspace ini.'
};

const NOT_FOUND: Partial<Record<ValkeyAction, string>> = {
	detach: 'Valkey ini sudah tidak terpasang ke proyek itu. Daftarnya sudah diperbarui.',
	load: 'Valkey ini tidak ada di workspace ini. Mungkin sudah dihapus.'
};

const BUSY: Partial<Record<ValkeyAction, string>> = {
	rotate: 'Penggantian password sebelumnya masih berjalan. Tunggu sampai selesai, lalu coba lagi.',
	resize: 'Perubahan sebelumnya masih berjalan. Tunggu sampai selesai, lalu ubah ukurannya lagi.',
	delete: 'Server sudah mulai membuat Valkey ini. Tunggu sampai siap atau gagal, lalu hapus lagi.'
};

const NOT_READY_BY_STATUS: Record<string, string> = {
	provisioning: 'Valkey ini masih dibuat. Tunggu sampai siap, lalu coba lagi.',
	failed: 'Valkey ini gagal dibuat, jadi tidak bisa dipakai. Hapus lalu buat Valkey baru.',
	deleting: 'Valkey ini sedang dihapus.'
};

export const PASSWORD_ROTATING_CREDENTIALS =
	'Password sedang diganti dan server belum memastikan password mana yang berlaku, jadi belum bisa ditampilkan. Tunggu sampai penggantian selesai. Kalau statusnya tidak pasti, ganti password sekali lagi.';

function memoryLimitText(details: { limit_mb: number; current_mb: number; requested_mb: number }) {
	const left = Math.max(details.limit_mb - details.current_mb, 0);
	return `Ukuran ${formatMegabytes(details.requested_mb)} melebihi sisa jatah memori Valkey workspace ini, ${formatMegabytes(left)} dari ${formatMegabytes(details.limit_mb)}. Pilih ukuran yang lebih kecil, kecilkan atau hapus Valkey lain, atau minta admin Sakala menaikkan jatahnya.`;
}

function nodeMismatchText(name: string | null): string {
	const store = name ? `Valkey ${name}` : 'Valkey itu';
	return `Proyek ini berjalan di server lain, sedangkan ${store} hanya bisa dijangkau dari server tempatnya berada. Buat Valkey baru untuk proyek ini.`;
}

/**
 * Copy for a refused Valkey request. Quota refusals are rebuilt from their fields so the numbers
 * read like the rest of the page; codes without a Console text keep the API's own Indonesian.
 */
export function valkeyErrorMessage(error: unknown, action: ValkeyAction, fallback: string): string {
	if (!(error instanceof ApiError)) return getErrorMessage(error, fallback);

	switch (error.code) {
		case VALKEY_ERROR_CODES.limitExceeded: {
			const details = parseValkeyRefusal('VALKEY_LIMIT_EXCEEDED', error.details);
			if (details?.limit === 0) return QUOTA_COPY.disabled;
			return details ? QUOTA_COPY.countFull(details.limit) : error.message;
		}
		case VALKEY_ERROR_CODES.memoryLimitExceeded: {
			const details = parseValkeyRefusal('VALKEY_MEMORY_LIMIT_EXCEEDED', error.details);
			if (!details) return error.message;
			return details.limit_mb === 0 ? QUOTA_COPY.disabled : memoryLimitText(details);
		}
		case VALKEY_ERROR_CODES.unavailable:
			return action === 'create'
				? 'Belum ada server yang bisa menjalankan Valkey untuk permintaan ini, di region yang dipilih atau di server tempat proyeknya berjalan. Pilih region lain, atau coba lagi nanti.'
				: error.message;
		case VALKEY_ERROR_CODES.capacityUnavailable:
			return 'Server Valkey sedang tidak punya cukup memori untuk ukuran ini. Pilih ukuran yang lebih kecil, atau coba lagi nanti.';
		case VALKEY_ERROR_CODES.notReady: {
			const details = parseValkeyRefusal('VALKEY_NOT_READY', error.details);
			if (action === 'credentials') return VALKEY_COPY.credentialsNotReady;
			return (details && NOT_READY_BY_STATUS[details.status]) ?? error.message;
		}
		case VALKEY_ERROR_CODES.locked:
			return 'Valkey ini sedang dikunci, jadi belum bisa dipasang ke proyek. Kalau kuncinya dari admin Sakala, hubungi admin untuk membukanya.';
		case VALKEY_ERROR_CODES.inUse: {
			const details = parseValkeyRefusal('VALKEY_IN_USE', error.details);
			const names = details?.projects.map((project) => project.name).join(', ');
			return names
				? `Valkey ini masih dipasang ke ${names}. Lepas dari semua proyek dulu, lalu hapus.`
				: error.message;
		}
		case VALKEY_ERROR_CODES.busy:
			return BUSY[action] ?? error.message;
		case VALKEY_ERROR_CODES.projectAlreadyAttached: {
			const details = parseValkeyRefusal('PROJECT_VALKEY_ALREADY_ATTACHED', error.details);
			const name = details?.valkey.name;
			return name
				? `Proyek ini sudah memakai Valkey ${name}. Satu proyek memakai satu Valkey, jadi lepas ${name} dulu kalau mau menggantinya.`
				: error.message;
		}
		case VALKEY_ERROR_CODES.nodeMismatch: {
			const details = parseValkeyRefusal('VALKEY_NODE_MISMATCH', error.details);
			return nodeMismatchText(details?.valkey.name ?? null);
		}
		case VALKEY_ERROR_CODES.passwordRotating:
			if (action === 'credentials') return PASSWORD_ROTATING_CREDENTIALS;
			return error.message;
	}

	if (error.isForbidden) return FORBIDDEN[action];
	if (error.status === 404) {
		return NOT_FOUND[action] ?? 'Valkey ini sudah tidak ada. Mungkin baru saja dihapus orang lain.';
	}
	return getErrorMessage(error, fallback);
}

/**
 * A deploy refused because of the attached store, in words that say what to do, or `null` for any
 * other refusal. Read by the project's deploy and redeploy controls.
 */
export function valkeyDeployRefusalMessage(error: unknown): string | null {
	if (!(error instanceof ApiError)) return null;
	switch (error.code) {
		case VALKEY_ERROR_CODES.notReady: {
			const details = parseValkeyRefusal('VALKEY_NOT_READY', error.details);
			if (details?.status === 'provisioning') {
				return 'Valkey yang dipasang ke proyek ini masih dibuat. Deploy lagi setelah Valkey-nya siap.';
			}
			return 'Valkey yang dipasang ke proyek ini tidak bisa dipakai. Lepas Valkey itu di tab Variabel, lalu pasang atau buat yang lain.';
		}
		case VALKEY_ERROR_CODES.passwordRotating: {
			const details = parseValkeyRefusal('VALKEY_PASSWORD_ROTATING', error.details);
			const store = details ? `Valkey ${details.valkey.name}` : 'Valkey proyek ini';
			return `Password ${store} sedang diganti dan server belum memastikan password mana yang berlaku, jadi deploy ditunda. Tunggu sebentar lalu deploy lagi. Kalau tetap ditolak, ganti password sekali lagi di halaman Valkey itu.`;
		}
		case VALKEY_ERROR_CODES.nodeMismatch: {
			const details = parseValkeyRefusal('VALKEY_NODE_MISMATCH', error.details);
			const store = details ? `Valkey ${details.valkey.name}` : 'Valkey yang dipasang';
			return `Proyek ini berjalan di server lain, sedangkan ${store} hanya bisa dijangkau dari server tempatnya berada. Lepas Valkey itu di tab Variabel, lalu buat Valkey baru untuk proyek ini.`;
		}
	}
	return null;
}

/* ---------- Redeploy after a change ---------- */

export type ValkeyRedeployNotice = {
	projectId: string;
	projectName: string;
	kind: 'attached' | 'detached';
	redeployRequired?: boolean;
};

export function valkeyRedeployNoticeText(notice: ValkeyRedeployNotice): string {
	switch (notice.kind) {
		case 'attached':
			return notice.redeployRequired === false
				? `${notice.projectName} menerima variabel Valkey ini saat deploy berikutnya.`
				: `Redeploy ${notice.projectName} supaya aplikasinya tersambung ke Valkey ini.`;
		case 'detached':
			return `Redeploy ${notice.projectName} supaya aplikasinya berhenti memakai Valkey ini. Isinya tetap ada.`;
	}
}

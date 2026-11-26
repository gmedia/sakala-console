import { ApiError, BUCKET_ERROR_CODES, getErrorMessage } from '$lib/api/errors';
import { parseBucketRefusal } from '$lib/api/resources/bucket-refusals';
import {
	BUCKET_COMMANDS,
	type Bucket,
	type BucketRotationRedeploy,
	type KnownBucketStatus
} from '$lib/api/resources/buckets';
import type { PilotLimits } from '$lib/api/resources/pilot-limits';
import type { BadgeTone } from '$lib/components/ui/Badge.svelte';
import {
	ATTACHED_REDEPLOY_SKIPPED_REASONS,
	BYTES_PER_MB,
	formatMegabytes,
	rotationCompletedText,
	storageMeter,
	type RotationRowCopy,
	type StorageMeter
} from '$lib/features/databases/presentation';
import { BUCKET_VARIABLES } from './variables';

export { BYTES_PER_MB, formatMegabytes };
export { BUCKET_VARIABLES } from './variables';

/** At this share of a bucket's quota the API notifies the workspace ("Bucket hampir penuh"). */
export const BUCKET_WARNING_RATIO = 0.8;

/** While a bucket is created or deleted the node reports back within seconds, so poll briefly. */
export const BUCKET_TRANSITION_POLL_MS = 5_000;

/** A key rotation usually completes in seconds, and the redeploys are queued right after. */
export const KEY_ROTATION_POLL_MS = 2_000;

/** Longest display name the API accepts (ManagedBucket::MAX_NAME_LENGTH). */
export const BUCKET_NAME_MAX_LENGTH = 100;

/** The quota range the API accepts (ManagedBucket::MIN_QUOTA_MB and MAX_QUOTA_MB). */
export const BUCKET_QUOTA_RANGE = { min: 1, max: 1024 * 1024 } as const;

export const BUCKET_COPY = {
	nav: 'Bucket',
	create: 'Buat bucket',
	creating: 'Membuat...',
	createForProject: 'Buat bucket untuk proyek ini',
	nameHint: 'Hanya untuk ditampilkan di Sakala. Nama bucket di server dibuat acak.',
	quotaHint: 'Upload yang melewati kuota ditolak. Kuota diambil dari jatah penyimpanan workspace.',
	privateNote:
		'Bucket ini privat. Browser membuka berkas lewat link sementara yang dibuat aplikasimu.',
	publicEndpoint: 'Terbuka dari internet. Jangan taruh secret key di repository.',
	publicEndpointWhy:
		'Alamat ini bisa dijangkau dari internet, jadi siapa pun yang memegang secret key bisa membaca dan menulis isi bucket.',
	credentialsAudit:
		'Setiap kali secret key ditampilkan, Sakala mencatatnya di log audit workspace.',
	credentialsOwnerOnly: 'Secret key hanya bisa dilihat pemilik workspace.',
	credentialsNotReady: 'Detail koneksi tersedia setelah bucket siap.',
	endpointMissing: 'Belum dilaporkan',
	endpointPending:
		'Server penyimpanan belum melaporkan alamatnya. Muat ulang halaman ini beberapa saat lagi.',
	reveal: 'Tampilkan secret key',
	envBlockTitle: 'Untuk .env di laptop',
	envBlockCopy: 'Salin semua',
	envBlockNote: 'Hanya untuk laptop atau server lain; proyek terpasang sudah menerimanya.',
	filesystemDiskHint:
		'Supaya upload Laravel otomatis masuk bucket, tambahkan variabel FILESYSTEM_DISK=s3.',
	backupNote:
		'Operator mem-backup isi bucket setiap malam dan menyimpannya sekitar dua minggu. Berkas yang ditulis setelah backup terakhir bisa hilang.',
	guideLink: 'Baca panduan bucket',
	notMeasured: 'Belum diukur',
	noProjects: 'Belum dipasang ke proyek',
	redeployLink: 'Buka proyek untuk redeploy',
	viewerNote: 'Kamu pengamat di workspace ini, jadi hanya bisa melihat bucket-nya.',
	unavailableTitle: 'Bucket terkelola belum tersedia di server ini',
	unavailableBody:
		'Belum ada server penyimpanan yang terhubung ke Sakala ini, jadi bucket baru belum bisa dibuat.',
	noQuota: 'Workspace ini belum bisa membuat bucket',
	noQuotaBody:
		'Bucket terkelola masih dibuka bertahap per workspace. Minta admin Sakala mengaktifkannya lewat profil batas workspace.',
	regionAuto: 'Otomatis'
} as const;

/* ---------- Feature availability (progressive disclosure) ---------- */

type BucketLimitFields = {
	quotas?: Partial<
		Pick<
			PilotLimits['quotas'],
			| 'max_buckets'
			| 'current_buckets_count'
			| 'max_bucket_storage_mb'
			| 'current_bucket_storage_mb'
		>
	>;
	buckets?: { available: boolean; default_quota_mb: number };
};

/**
 * Whether the workspace has anything to do with buckets: the API knows them, and the workspace may
 * create one or already holds one. Everyone else never sees a bucket entry, the way a sleeping
 * project only mentions files when it matters. Unknown, while the limits load, is "no".
 */
export function bucketsInUse(limits: BucketLimitFields | undefined): boolean {
	if (!limits?.buckets) return false;
	return (limits.quotas?.max_buckets ?? 0) > 0 || (limits.quotas?.current_buckets_count ?? 0) > 0;
}

/**
 * Whether this installation offers no managed buckets now (`buckets.available` false). Unknown, while
 * the limits load or from an older API, is not "unavailable".
 */
export function bucketsUnavailable(limits: BucketLimitFields | undefined): boolean {
	return limits?.buckets?.available === false;
}

/** MB the workspace may still reserve for bucket quotas, or `null` for an API without the fields. */
export function remainingBucketStorageMb(limits: BucketLimitFields | undefined): number | null {
	const max = limits?.quotas?.max_bucket_storage_mb;
	const current = limits?.quotas?.current_bucket_storage_mb;
	if (max === undefined || current === undefined) return null;
	return Math.max(max - current, 0);
}

/**
 * Whether a project page may offer "Buat bucket untuk proyek ini": the server takes buckets, and
 * the workspace has a bucket and at least 1 MB left. Otherwise the page stays quiet.
 */
export function canOfferProjectBucket(limits: BucketLimitFields | undefined): boolean {
	if (!limits?.buckets?.available) return false;
	const max = limits.quotas?.max_buckets ?? 0;
	const used = limits.quotas?.current_buckets_count ?? 0;
	const remaining = remainingBucketStorageMb(limits) ?? 0;
	return max > used && remaining >= BUCKET_QUOTA_RANGE.min;
}

/**
 * The quota the create dialog starts with: the server's default, capped at what the workspace has
 * left, like the API does without `quota_mb`. Admins are not capped by the workspace.
 */
export function defaultBucketQuotaMb(
	limits: BucketLimitFields | undefined,
	isSiteAdmin = false
): number {
	const fallback = limits?.buckets?.default_quota_mb ?? BUCKET_QUOTA_RANGE.min;
	const remaining = remainingBucketStorageMb(limits);
	if (isSiteAdmin || remaining === null) return Math.max(fallback, BUCKET_QUOTA_RANGE.min);
	return Math.max(Math.min(fallback, remaining), BUCKET_QUOTA_RANGE.min);
}

/* ---------- Status ---------- */

export type BucketStatusView = {
	label: string;
	tone: BadgeTone;
	/** What the status means for the apps that use it, and what to do about it. */
	description: string;
	/** The node is working on it; the page polls until it settles. */
	transitional: boolean;
};

const STATUS_VIEWS: Record<KnownBucketStatus, Omit<BucketStatusView, 'description'>> = {
	provisioning: { label: 'Menyiapkan', tone: 'running', transitional: true },
	ready: { label: 'Siap', tone: 'success', transitional: false },
	failed: { label: 'Gagal', tone: 'error', transitional: false },
	deleting: { label: 'Menghapus', tone: 'queued', transitional: true },
	locked: { label: 'Dikunci', tone: 'warning', transitional: false }
};

const STATUS_DESCRIPTIONS: Record<KnownBucketStatus, string> = {
	provisioning:
		'Server penyimpanan sedang membuat bucket ini. Halaman ini memperbarui sendiri begitu siap.',
	ready: 'Menerima upload dan unduhan dari proyek yang terpasang.',
	failed: 'Bucket ini gagal dibuat, jadi tidak bisa dipakai. Hapus lalu buat bucket baru.',
	deleting: 'Server penyimpanan sedang menghapus bucket ini beserta isinya.',
	locked:
		'Bucket ini dikunci admin Sakala. Aplikasi tidak bisa membaca atau menulis berkas, dan link sementara tidak berlaku.'
};

function isKnownStatus(status: string): status is KnownBucketStatus {
	return status in STATUS_VIEWS;
}

/** The label, tone, and meaning of a status. A status from a newer API still shows as itself. */
export function bucketStatusView(
	bucket: Pick<Bucket, 'status' | 'last_failure'>
): BucketStatusView {
	if (!isKnownStatus(bucket.status)) {
		return {
			label: bucket.status,
			tone: 'neutral',
			description:
				'Status ini belum dikenal Console. Muat ulang halaman untuk melihat yang terbaru.',
			transitional: false
		};
	}
	const view = STATUS_VIEWS[bucket.status];
	const failure = bucket.last_failure;
	const description =
		bucket.status === 'failed' && failure?.command === BUCKET_COMMANDS.create
			? `${failure.summary} Hapus bucket ini lalu buat lagi.`
			: STATUS_DESCRIPTIONS[bucket.status];
	return { ...view, description };
}

const ROW_NOTES: Partial<Record<KnownBucketStatus, string>> = {
	provisioning: 'Sedang dibuat di server penyimpanan',
	failed: 'Gagal dibuat. Hapus lalu buat lagi.',
	deleting: 'Sedang dihapus beserta isinya',
	locked: 'Dikunci admin Sakala, jadi aplikasi tidak bisa membaca atau menulis'
};

/** One line under a list row's name, for the statuses that need one. */
export function bucketRowNote(bucket: Pick<Bucket, 'status'>): string | null {
	return isKnownStatus(bucket.status) ? (ROW_NOTES[bucket.status] ?? null) : null;
}

/** `jkt`, or `Otomatis` for a bucket on a node without a Sakala region. */
export function regionText(region: string | null): string {
	return region ?? BUCKET_COPY.regionAuto;
}

export function isTransitional(bucket: Pick<Bucket, 'status'>): boolean {
	return isKnownStatus(bucket.status) && STATUS_VIEWS[bucket.status].transitional;
}

/** `ready` and `locked` exist on the node: they have a connection, credentials, and a quota. */
export function isOnNode(bucket: Pick<Bucket, 'status'>): boolean {
	return bucket.status === 'ready' || bucket.status === 'locked';
}

/* ---------- Usage ---------- */

export const FULL_COPY = {
	label: 'Penuh',
	description: 'Upload baru ditolak sampai ada berkas yang dihapus atau kuota dinaikkan.',
	nearlyFull: 'Hampir penuh. Upload yang melewati kuota akan ditolak.'
} as const;

/** What the bucket holds against its own hard quota. */
export function bucketUsageMeter(bucket: Pick<Bucket, 'size_bytes' | 'quota_mb'>): StorageMeter {
	return storageMeter(bucket.size_bytes, bucket.quota_mb);
}

/** The node refuses uploads once usage reaches the quota; the derived "Penuh" badge says so. */
export function isBucketFull(bucket: Pick<Bucket, 'size_bytes' | 'quota_mb'>): boolean {
	return bucket.size_bytes !== null && bucket.size_bytes >= bucket.quota_mb * BYTES_PER_MB;
}

/** A quota change on its way, in words: `Kuota sedang diubah menjadi 512 MB.` */
export function pendingQuotaText(bucket: Pick<Bucket, 'pending_quota_mb'>): string | null {
	return bucket.pending_quota_mb === null
		? null
		: `Kuota sedang diubah menjadi ${formatMegabytes(bucket.pending_quota_mb)}. Server penyimpanan menerapkannya dalam beberapa detik.`;
}

/* ---------- Workspace quota ---------- */

const countFormat = new Intl.NumberFormat('id-ID');

export const QUOTA_COPY = {
	disabled:
		'Workspace ini belum bisa membuat bucket. Minta admin Sakala mengaktifkannya lewat profil batas workspace.',
	countFull: (max: number) =>
		`Workspace ini sudah memakai ${countFormat.format(max)} dari ${countFormat.format(max)} bucket. Hapus bucket yang tidak dipakai, atau minta admin Sakala menaikkan batasnya.`,
	storageFull:
		'Jatah penyimpanan bucket workspace ini sudah habis dialokasikan. Kecilkan kuota bucket lain, hapus yang tidak dipakai, atau minta admin Sakala menaikkan jatahnya.',
	allocationHint: 'Kuota dialokasikan dari jatah penyimpanan workspace.'
} as const;

export type BucketQuota = {
	count: { used: number; max: number; label: string; full: boolean };
	/** Quotas reserved against the workspace's bucket storage: `dialokasikan 300 MB dari 1 GB`. */
	allocation: StorageMeter;
	/** What the buckets hold together: `terpakai 36 MB`. */
	usedLabel: string;
	remainingMb: number;
	/** Why a new bucket would be refused now, or `null` when it would not. */
	blockedReason: string | null;
};

type QuotaFields = Pick<
	PilotLimits['quotas'],
	| 'max_buckets'
	| 'current_buckets_count'
	| 'max_bucket_storage_mb'
	| 'current_bucket_storage_mb'
	| 'current_bucket_usage_bytes'
>;

/** The workspace's bucket count and allocation, or `null` for an API without bucket quotas. */
export function bucketQuota(quotas: Partial<QuotaFields> | undefined): BucketQuota | null {
	if (
		quotas?.max_buckets === undefined ||
		quotas.current_buckets_count === undefined ||
		quotas.max_bucket_storage_mb === undefined ||
		quotas.current_bucket_storage_mb === undefined ||
		quotas.current_bucket_usage_bytes === undefined
	) {
		return null;
	}
	const max = quotas.max_buckets;
	const used = quotas.current_buckets_count;
	const reservedMb = quotas.current_bucket_storage_mb;
	const limitMb = quotas.max_bucket_storage_mb;
	const allocation = storageMeter(reservedMb * BYTES_PER_MB, limitMb);
	const remainingMb = Math.max(limitMb - reservedMb, 0);
	const countFull = used >= max;

	let blockedReason: string | null = null;
	if (max === 0) blockedReason = QUOTA_COPY.disabled;
	else if (countFull) blockedReason = QUOTA_COPY.countFull(max);
	else if (remainingMb < BUCKET_QUOTA_RANGE.min) blockedReason = QUOTA_COPY.storageFull;

	return {
		count: {
			used,
			max,
			label: `${countFormat.format(used)} dari ${countFormat.format(max)} bucket`,
			full: countFull
		},
		allocation: {
			...allocation,
			label: `dialokasikan ${allocation.label}`,
			accessibleLabel: `Dialokasikan ${allocation.accessibleLabel}`
		},
		usedLabel: `terpakai ${formatMegabytes(quotas.current_bucket_usage_bytes / BYTES_PER_MB)}`,
		remainingMb,
		blockedReason
	};
}

/* ---------- Key rotation ---------- */

export const KEY_ROTATION_COPY = {
	title: 'Ganti secret key',
	lead: 'Buat secret key baru kalau yang lama mungkin bocor.',
	action: 'Ganti secret key',
	dialogTitle: 'Ganti secret key bucket?',
	dialogConfirm: 'Ganti secret key',
	dialogBusy: 'Meminta...',
	rotateBody:
		'Secret key lama langsung berhenti berlaku. Aplikasi yang sedang berjalan tidak bisa membaca atau menulis berkas sampai di-redeploy.',
	dialogApps: 'Proyek yang terpasang:',
	dialogNoProjects:
		'Bucket ini belum dipasang ke proyek. Kalau secret key lama dipakai di tempat lain, ganti juga di sana.',
	autoRedeploy: 'Redeploy otomatis proyek yang terpasang',
	autoRedeployHint:
		'Begitu secret key baru aktif, Sakala men-deploy ulang versi yang sedang live di setiap proyek.',
	manualRedeploy:
		'Tanpa redeploy otomatis, kamu perlu redeploy setiap proyek sendiri. Sampai itu, aplikasinya tidak bisa membaca atau menulis berkas.',
	requested: 'Penggantian secret key diminta.',
	pending:
		'Server penyimpanan sedang mengganti secret key. Secret key lama berhenti berlaku saat itu juga.',
	queueing: 'Menyiapkan redeploy proyek yang terpasang...',
	failedPrefix: 'Penggantian secret key terakhir gagal, jadi secret key lama masih berlaku.',
	unknown:
		'Server penyimpanan tidak bisa memastikan secret key mana yang berlaku. Selama belum pasti, deploy proyek yang terpasang dan Tampilkan secret key ditolak. Ganti secret key sekali lagi untuk membereskannya.',
	unknownReveal:
		'Secret key belum bisa ditampilkan karena belum pasti mana yang berlaku. Penjelasannya ada di bagian Ganti secret key di bawah.',
	unknownNoAccess:
		'Server penyimpanan tidak bisa memastikan secret key mana yang berlaku, jadi deploy proyek yang terpasang ditolak sampai pemilik atau anggota workspace mengganti secret key sekali lagi.',
	completed: (completedAt: string, now?: Date) =>
		rotationCompletedText(completedAt, now, 'Secret key')
} as const;

/** The rotation rows' words, for the rows shared with database password rotation. */
export const KEY_ROTATION_ROW_COPY: RotationRowCopy = {
	rowQueued: 'Redeploy otomatis berjalan',
	rowDone: 'Sudah memakai secret key baru',
	rowFirstDeploy: 'Belum di-deploy. Deploy pertamanya memakai secret key baru.',
	rowNeedsRedeploy: 'Masih memakai secret key lama, jadi belum bisa membaca atau menulis berkas',
	viewDeployment: 'Lihat deployment',
	redeploy: 'Redeploy',
	redeploying: 'Menjalankan...',
	redeployFailed: 'Redeploy belum bisa dijalankan. Muat ulang halaman, lalu tekan Redeploy lagi.'
};

/** The shared reasons, with the requester's in the words of a key rotation. */
export const KEY_ROTATION_SKIPPED_REASONS: Record<string, string> = {
	...ATTACHED_REDEPLOY_SKIPPED_REASONS,
	requester_cannot_deploy:
		'Redeploy otomatis dilewati karena akun yang mengganti secret key tidak lagi bisa men-deploy proyek ini.'
};

/** A failed rotation keeps the old secret, and `last_failure` says why. */
export function keyRotationFailure(bucket: Pick<Bucket, 'last_failure'>) {
	return bucket.last_failure?.command === BUCKET_COMMANDS.rotateKey ? bucket.last_failure : null;
}

/** The newest rotation is not settled: the node has not reported, or redeploys are being queued. */
export function isKeyRotationSettling(bucket: Partial<Pick<Bucket, 'key_rotation'>>): boolean {
	const rotation = bucket.key_rotation;
	if (!rotation) return false;
	if (rotation.status === 'pending') return true;
	return (
		rotation.status === 'completed' && rotation.redeploy_attached && rotation.redeploys === null
	);
}

/**
 * The key is in an uncertain state that ended without an answer: neither secret is known to work.
 * The API refuses credentials and deploys (`BUCKET_KEY_ROTATING`) until a new rotation.
 */
export function isKeyUnknown(bucket: Partial<Pick<Bucket, 'key_rotation'>>): boolean {
	return bucket.key_rotation?.status === 'unknown';
}

export type KeyRotationView =
	| { state: 'pending' }
	| { state: 'failed'; summary: string | null }
	| { state: 'unknown' }
	| {
			state: 'completed';
			completedText: string;
			queueing: boolean;
			redeploys: Map<string, BucketRotationRedeploy>;
			redeployAttached: boolean;
	  }
	| null;

/** What the "Ganti secret key" section says about the newest rotation. */
export function keyRotationView(
	bucket: Pick<Bucket, 'key_rotation' | 'last_failure'>,
	now: Date = new Date()
): KeyRotationView {
	const rotation = bucket.key_rotation;
	if (!rotation) return null;
	if (rotation.status === 'pending') return { state: 'pending' };
	if (rotation.status === 'unknown') return { state: 'unknown' };
	if (rotation.status === 'failed') {
		return { state: 'failed', summary: keyRotationFailure(bucket)?.summary ?? null };
	}
	if (rotation.status !== 'completed' || !rotation.completed_at) return null;
	return {
		state: 'completed',
		completedText: KEY_ROTATION_COPY.completed(rotation.completed_at, now),
		queueing: rotation.redeploy_attached && rotation.redeploys === null,
		redeploys: new Map((rotation.redeploys ?? []).map((item) => [item.project_id, item])),
		redeployAttached: rotation.redeploy_attached
	};
}

/** Poll while a rotation settles or the node creates, resizes, or deletes a bucket. */
export function resolveBucketPollInterval(
	buckets:
		| readonly (Pick<Bucket, 'status'> &
				Partial<Pick<Bucket, 'key_rotation' | 'pending_quota_mb'>>)[]
		| undefined
): number | false {
	if (buckets?.some(isKeyRotationSettling)) return KEY_ROTATION_POLL_MS;
	return buckets?.some(
		(bucket) => isTransitional(bucket) || (bucket.pending_quota_mb ?? null) !== null
	)
		? BUCKET_TRANSITION_POLL_MS
		: false;
}

export type ProvisioningStep = { label: string; state: 'done' | 'current' | 'pending' };

/** The steps of a creation, from what the API can tell; it gives no percentage. */
export function provisioningSteps(bucket: Pick<Bucket, 'status'>): ProvisioningStep[] {
	const ready = bucket.status !== 'provisioning';
	return [
		{ label: 'Permintaan diterima', state: 'done' },
		{ label: 'Server penyimpanan membuat bucket', state: ready ? 'done' : 'current' },
		{ label: 'Siap dipakai', state: ready ? 'done' : 'pending' }
	];
}

/**
 * The failure to show beside the status, when it is not the status's own explanation or the
 * rotation section's.
 */
export function separateFailure(bucket: Pick<Bucket, 'status' | 'last_failure'>) {
	const failure = bucket.last_failure;
	if (!failure) return null;
	if (bucket.status === 'failed' && failure.command === BUCKET_COMMANDS.create) return null;
	if (failure.command === BUCKET_COMMANDS.rotateKey) return null;
	return failure;
}

/* ---------- Variables ---------- */

/**
 * The `.env` lines for a laptop or another host, from the credentials answer: exactly what an
 * attached project receives, in the API's order, then any name a newer API adds.
 */
export function bucketEnvBlock(variables: Record<string, string>): string {
	const known: readonly string[] = BUCKET_VARIABLES;
	const names = [
		...known.filter((name) => name in variables),
		...Object.keys(variables).filter((name) => !known.includes(name))
	];
	return names.map((name) => `${name}=${variables[name]}`).join('\n');
}

/* ---------- Errors ---------- */

export type BucketAction =
	| 'create'
	| 'rename'
	| 'quota'
	| 'delete'
	| 'attach'
	| 'detach'
	| 'credentials'
	| 'rotate'
	| 'load';

const FORBIDDEN: Record<BucketAction, string> = {
	create: 'Hanya pemilik dan anggota workspace yang bisa membuat bucket.',
	rename: 'Hanya pemilik dan anggota workspace yang bisa mengganti nama bucket.',
	quota: 'Hanya pemilik dan anggota workspace yang bisa mengubah kuota bucket.',
	delete: 'Hanya pemilik dan anggota workspace yang bisa menghapus bucket.',
	attach: 'Hanya pemilik dan anggota workspace yang bisa memasang bucket ke proyek.',
	detach: 'Hanya pemilik dan anggota workspace yang bisa melepas bucket dari proyek.',
	credentials: 'Secret key hanya bisa dilihat pemilik workspace.',
	rotate: 'Hanya pemilik dan anggota workspace yang bisa mengganti secret key bucket.',
	load: 'Kamu tidak punya akses ke bucket di workspace ini.'
};

const NOT_FOUND: Partial<Record<BucketAction, string>> = {
	detach: 'Bucket ini sudah tidak terpasang ke proyek itu. Daftar proyeknya sudah diperbarui.',
	load: 'Bucket ini tidak ada di workspace ini. Mungkin sudah dihapus.'
};

/** For a refused credentials read during an unsettled rotation. */
export const KEY_ROTATING_CREDENTIALS =
	'Secret key sedang diganti dan server penyimpanan belum memastikan key mana yang berlaku, jadi secret key belum bisa ditampilkan. Tunggu sampai penggantian selesai. Kalau statusnya "tidak pasti", ganti secret key sekali lagi.';

/**
 * Copy for a refused bucket request. Quota and region refusals are rebuilt from their fields so the
 * numbers read like the rest of the page; the other codes carry the API's own Indonesian text.
 */
export function bucketErrorMessage(error: unknown, action: BucketAction, fallback: string): string {
	if (!(error instanceof ApiError)) return getErrorMessage(error, fallback);

	switch (error.code) {
		case BUCKET_ERROR_CODES.limitExceeded: {
			const details = parseBucketRefusal('BUCKET_LIMIT_EXCEEDED', error.details);
			if (details?.limit === 0) return QUOTA_COPY.disabled;
			return details ? QUOTA_COPY.countFull(details.limit) : error.message;
		}
		case BUCKET_ERROR_CODES.storageLimitExceeded: {
			const details = parseBucketRefusal('BUCKET_STORAGE_LIMIT_EXCEEDED', error.details);
			if (!details) return error.message;
			if (details.limit_mb === 0) return QUOTA_COPY.disabled;
			const left = Math.max(details.limit_mb - details.current_mb, 0);
			return `Kuota ${formatMegabytes(details.requested_mb)} melebihi sisa jatah penyimpanan bucket workspace ini, ${formatMegabytes(left)} dari ${formatMegabytes(details.limit_mb)}. Kecilkan kuotanya, kecilkan atau hapus bucket lain, atau minta admin Sakala menaikkan jatahnya.`;
		}
		case BUCKET_ERROR_CODES.regionUnavailable: {
			const details = parseBucketRefusal('BUCKET_REGION_UNAVAILABLE', error.details);
			if (details?.region) {
				return `Belum ada server penyimpanan di region ${details.region}. Pilih region lain, atau pilih ${BUCKET_COPY.regionAuto}.`;
			}
			return 'Belum ada server penyimpanan yang bisa menerima bucket baru. Hubungi operator Sakala, atau buat bucket nanti.';
		}
		case BUCKET_ERROR_CODES.keyRotating:
			if (action === 'credentials') return KEY_ROTATING_CREDENTIALS;
			break;
	}

	if (error.isForbidden) return FORBIDDEN[action];
	if (error.status === 404) {
		return NOT_FOUND[action] ?? 'Bucket ini sudah tidak ada. Mungkin baru saja dihapus orang lain.';
	}
	return getErrorMessage(error, fallback);
}

/* ---------- Redeploy after a change ---------- */

export type BucketRedeployNotice = {
	projectId: string;
	projectName: string;
	kind: 'attached' | 'detached';
	redeployRequired?: boolean;
};

export function bucketRedeployNoticeText(notice: BucketRedeployNotice): string {
	switch (notice.kind) {
		case 'attached':
			return notice.redeployRequired === false
				? `${notice.projectName} menerima variabel bucket ini saat deploy berikutnya.`
				: `Redeploy ${notice.projectName} supaya aplikasinya menerima variabel bucket ini.`;
		case 'detached':
			return `Redeploy ${notice.projectName} supaya aplikasinya berhenti memakai bucket ini. Isinya tetap ada.`;
	}
}

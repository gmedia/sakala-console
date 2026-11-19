import type { Database } from '$lib/api/resources/databases';
import { DATABASE_COPY } from '$lib/features/databases/presentation';

/**
 * The one decision the first deploy asks about a database: a new one made for this project, one
 * the workspace already has, or none.
 */
export const DATABASE_OPTIONS = { create: 'create', attach: 'attach', none: 'none' } as const;
export type DatabaseOption = (typeof DATABASE_OPTIONS)[keyof typeof DATABASE_OPTIONS];

export const DATABASE_CHOICE_COPY = {
	title: 'Aplikasi ini sepertinya butuh database',
	disclosure: 'Aplikasi ini butuh database?',
	create: 'Buat database baru untuk proyek ini',
	createHint: 'PostgreSQL, khusus proyek ini. Deploy dimulai otomatis setelah database siap.',
	attach: 'Pakai database yang sudah ada',
	attachHint: 'Database lain di workspace ini, di region yang sama.',
	attachSelect: 'Database',
	attachEmpty: 'Workspace ini belum punya database.',
	attachNoneUsable: 'Belum ada database yang bisa dipakai proyek ini.',
	attachFailed:
		'Daftar database workspace belum bisa dimuat. Muat ulang halaman ini untuk mencoba lagi.',
	none: 'Tanpa database',
	noneHint: 'Bisa dipasang nanti dari halaman Database.',
	variablesNote:
		'DATABASE_URL dan DB_* diisi Sakala saat deploy, jadi tidak perlu ditulis sendiri.',
	unavailable: `${DATABASE_COPY.unavailableTitle}, jadi database baru belum bisa dibuat dari sini.`
} as const;

/** Why "Buat database baru" cannot be picked now, or `null` when it can. */
export function createDatabaseBlockedReason({
	unavailable,
	quotaBlockedReason
}: {
	unavailable: boolean;
	quotaBlockedReason: string | null;
}): string | null {
	if (unavailable) return DATABASE_CHOICE_COPY.unavailable;
	return quotaBlockedReason;
}

/**
 * A new database is preselected only when the app likely needs one and one can be made; otherwise
 * nothing is created unless the user asks. Using an existing one is never preselected: it shares
 * data, which needs a deliberate choice.
 */
export function defaultDatabaseOption({
	likely,
	createBlocked
}: {
	likely: boolean;
	createBlocked: boolean;
}): DatabaseOption {
	return likely && !createBlocked ? DATABASE_OPTIONS.create : DATABASE_OPTIONS.none;
}

/** Why a database of the workspace cannot be attached to this project, by its status. */
const STATUS_REASONS: Record<string, string> = {
	provisioning: 'Masih dibuat',
	failed: 'Gagal dibuat',
	deleting: 'Sedang dihapus',
	locked: 'Terkunci, penyimpanan workspace penuh'
};

const READY_STATUS = 'ready';

export type AttachCandidate = {
	id: string;
	name: string;
	/** Shown beside a disabled option; `null` when the database can be picked. */
	disabledReason: string | null;
};

/**
 * The workspace's databases as options for this project. One that is not ready, is used by another
 * project, or lives in another region is listed but disabled, with the reason: hiding it would
 * make the user wonder where it went.
 */
export function attachCandidates(
	databases: readonly Pick<Database, 'id' | 'name' | 'status' | 'region' | 'projects'>[],
	project: { id: string; region?: string | null }
): AttachCandidate[] {
	return databases.map((database) => {
		const others = database.projects.filter((item) => item.id !== project.id);
		let disabledReason: string | null = null;
		if (database.status !== READY_STATUS) {
			disabledReason = STATUS_REASONS[database.status] ?? 'Belum siap';
		} else if (others.length > 0) {
			disabledReason = `Dipakai ${others[0].name}`;
		} else if (database.region && project.region && database.region !== project.region) {
			disabledReason = `Region ${database.region}, proyek ini di ${project.region}`;
		}
		return { id: database.id, name: database.name, disabledReason };
	});
}

export function firstUsableCandidate(candidates: readonly AttachCandidate[]): string | null {
	return candidates.find((candidate) => candidate.disabledReason === null)?.id ?? null;
}

/**
 * The release command to suggest beside a database: the agent's suggestion, only when a database
 * is chosen and the project has none of its own. An existing release command is never touched.
 */
export function suggestedReleaseCommand({
	option,
	current,
	suggestion
}: {
	option: DatabaseOption;
	current: string | null | undefined;
	suggestion: string | null | undefined;
}): string | null {
	if (option === DATABASE_OPTIONS.none || current?.trim() || !suggestion) return null;
	return suggestion;
}

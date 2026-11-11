import { ApiError, getErrorMessage } from '$lib/api/errors';
import type {
	AcceptErrorCode,
	Workspace,
	WorkspaceMember,
	WorkspaceRole,
	WorkspaceSummary
} from '$lib/api/resources/workspaces';

export const ROLE_LABELS: Record<WorkspaceRole, string> = {
	owner: 'Pemilik',
	member: 'Anggota',
	viewer: 'Pengamat'
};

/** What each role may do, as the API enforces it (WorkspaceRole in sakala-api). */
export const ROLE_DESCRIPTIONS: Record<WorkspaceRole, string> = {
	owner: 'Mengelola anggota, undangan, dan workspace, juga semua yang bisa dilakukan anggota.',
	member: 'Membuat, men-deploy, dan mengelola proyek, termasuk environment variable.',
	viewer:
		'Melihat proyek, deployment, dan log saja. Tidak bisa melihat nilai secret atau mengubah apa pun.'
};

export const ROLE_ORDER: readonly WorkspaceRole[] = ['owner', 'member', 'viewer'];

export function canManageProjects(role: WorkspaceRole | null | undefined): boolean {
	return role === 'owner' || role === 'member';
}

export function canManageWorkspace(role: WorkspaceRole | null | undefined): boolean {
	return role === 'owner';
}

/** A personal workspace is named after its owner, so it is labelled by what it is. */
export function workspaceLabel(workspace: Pick<WorkspaceSummary, 'name' | 'type'>): string {
	return workspace.type === 'personal' ? 'Pribadi' : workspace.name;
}

/** The pilot-limits parameter: the personal workspace is the API's default and is asked without it. */
export function limitsWorkspaceId(
	workspace: Pick<Workspace, 'id' | 'type'> | null | undefined
): string | null {
	return workspace && workspace.type === 'team' ? workspace.id : null;
}

export function countOwners(members: readonly Pick<WorkspaceMember, 'role'>[]): number {
	return members.filter((member) => member.role === 'owner').length;
}

export const LAST_OWNER_REASON =
	'Ini satu-satunya pemilik. Jadikan anggota lain pemilik dulu, karena workspace tim harus selalu punya pemilik.';

/**
 * Whether a member's role can be lowered or the member removed. The last owner can be neither,
 * which the API refuses with LAST_WORKSPACE_OWNER; the UI says so before anyone tries.
 */
export function memberGuard(
	member: Pick<WorkspaceMember, 'role'>,
	members: readonly Pick<WorkspaceMember, 'role'>[]
): { isLastOwner: boolean; reason: string | null } {
	const isLastOwner = member.role === 'owner' && countOwners(members) <= 1;
	return { isLastOwner, reason: isLastOwner ? LAST_OWNER_REASON : null };
}

export const LAST_OWNER_LEAVE_REASON =
	'Kamu satu-satunya pemilik, jadi belum bisa keluar. Jadikan anggota lain pemilik dulu, atau hapus workspace ini kalau sudah tidak dipakai.';

export function leaveGuard(
	myRole: WorkspaceRole | null | undefined,
	members: readonly Pick<WorkspaceMember, 'role'>[]
): string | null {
	return myRole === 'owner' && countOwners(members) <= 1 ? LAST_OWNER_LEAVE_REASON : null;
}

export function projectCountLabel(count: number): string {
	return count === 0 ? 'Belum ada proyek' : `${count} proyek`;
}

/** "3 proyek", with deployments running now when there are any. */
export function workspaceCountsLabel(
	workspace: Pick<Workspace, 'projects_count' | 'active_deployments_count'>
): string {
	const projects = projectCountLabel(workspace.projects_count);
	return workspace.active_deployments_count > 0
		? `${projects} · ${workspace.active_deployments_count} deployment berjalan`
		: projects;
}

export function deleteGuard(projectCount: number | undefined): string | null {
	if (!projectCount) return null;
	return `Workspace ini masih punya ${projectCount} proyek. Hapus proyeknya dulu lewat tab Pengaturan di halaman proyek, lalu hapus workspace-nya.`;
}

/**
 * Copy for a refused workspace action. The API sends a stable `code` and a message meant for
 * people; the codes the UI can explain better get their own text, the rest use the API's.
 */
export function workspaceErrorMessage(error: unknown, fallback: string): string {
	if (error instanceof ApiError) {
		switch (error.code) {
			case 'LAST_WORKSPACE_OWNER':
				return 'Workspace tim harus selalu punya pemilik. Jadikan anggota lain pemilik dulu, lalu coba lagi.';
			case 'WORKSPACE_NOT_EMPTY':
				return 'Workspace ini masih punya proyek. Hapus proyeknya dulu, lalu hapus workspace-nya.';
			case 'EMAIL_VERIFICATION_REQUIRED':
				return 'Verifikasi email kamu dulu sebelum membuat atau bergabung ke workspace tim. Buka tautan verifikasi yang dikirim ke email kamu, lalu coba lagi.';
			case 'TEAM_LIMIT_EXCEEDED':
			case 'ALREADY_WORKSPACE_MEMBER':
			case 'WORKSPACE_IS_PERSONAL':
				return error.message;
		}
		if (error.isForbidden) {
			return 'Kamu tidak punya izin untuk ini. Hanya pemilik workspace yang bisa mengelola anggota dan workspace.';
		}
		if (error.status === 404) {
			return 'Data ini sudah tidak ada. Mungkin baru saja diubah orang lain, jadi muat ulang halaman.';
		}
	}
	return getErrorMessage(error, fallback);
}

export type InvitationProblem =
	| 'expired'
	| 'already_accepted'
	| 'declined'
	| 'revoked'
	| 'not_found'
	| 'email_mismatch'
	| 'already_member'
	| 'team_limit'
	| 'unverified'
	| 'other';

const PROBLEM_BY_CODE: Record<string, Exclude<InvitationProblem, 'not_found' | 'other'>> = {
	INVITATION_EXPIRED: 'expired',
	INVITATION_ALREADY_ACCEPTED: 'already_accepted',
	INVITATION_DECLINED: 'declined',
	INVITATION_REVOKED: 'revoked',
	INVITATION_EMAIL_MISMATCH: 'email_mismatch',
	ALREADY_WORKSPACE_MEMBER: 'already_member',
	TEAM_LIMIT_EXCEEDED: 'team_limit',
	EMAIL_VERIFICATION_REQUIRED: 'unverified'
};

/**
 * What a refused read, accept, or decline means. A wrong or incomplete token is a plain 404 whatever
 * the invitation's state; with the right token the API names the state with a code.
 */
export function invitationProblem(error: unknown): InvitationProblem {
	if (!(error instanceof ApiError)) return 'other';
	const known = error.code ? PROBLEM_BY_CODE[error.code] : undefined;
	if (known) return known;
	return error.status === 404 ? 'not_found' : 'other';
}

/** Why this account cannot accept an open invitation, as its read reports it. */
export function acceptBlockedProblem(code: AcceptErrorCode): InvitationProblem {
	return PROBLEM_BY_CODE[code] ?? 'other';
}

/** What each problem means for the person holding the link. */
export const INVITATION_PROBLEM_COPY: Record<
	Exclude<InvitationProblem, 'other'>,
	{ title: string; message: string }
> = {
	expired: {
		title: 'Undangan sudah kedaluwarsa',
		message:
			'Masa berlaku undangan ini sudah lewat. Minta pemilik workspace mengirim undangan baru ke email kamu.'
	},
	already_accepted: {
		title: 'Undangan sudah diterima',
		message:
			'Undangan ini sudah dipakai untuk bergabung. Kalau kamu yang menerimanya, workspace-nya ada di pengalih workspace. Kalau bukan, minta pemilik workspace mengirim undangan baru.'
	},
	declined: {
		title: 'Undangan sudah ditolak',
		message:
			'Undangan ini sudah ditolak, jadi tidak bisa dipakai lagi. Minta pemilik workspace mengirim undangan baru kalau kamu ingin bergabung.'
	},
	revoked: {
		title: 'Undangan sudah dibatalkan',
		message:
			'Pemilik workspace membatalkan undangan ini atau menggantinya dengan undangan baru. Cek email undangan terbaru, atau minta pemilik workspace mengundangmu lagi.'
	},
	not_found: {
		title: 'Undangan tidak ditemukan',
		message:
			'Tautan undangan ini tidak lengkap atau sudah tidak berlaku. Buka lagi tautan dari email undangan, atau minta pemilik workspace mengirim undangan baru.'
	},
	email_mismatch: {
		title: 'Undangan ini untuk email lain',
		message:
			'Undangan sebagai pemilik hanya bisa diterima akun dengan email yang diundang. Masuk dengan akun itu, atau minta undangan baru ke email akunmu.'
	},
	already_member: {
		title: 'Kamu sudah menjadi anggota',
		message: 'Akunmu sudah tergabung di workspace ini, jadi undangan ini tidak perlu diterima lagi.'
	},
	team_limit: {
		title: 'Batas workspace tim tercapai',
		message:
			'Kamu sudah memiliki workspace tim sebanyak batasnya, jadi belum bisa menerima undangan sebagai pemilik. Hapus tim yang tidak dipakai, atau minta admin Sakala menaikkan batasnya.'
	},
	unverified: {
		title: 'Verifikasi email dulu',
		message:
			'Bergabung ke workspace tim butuh email yang sudah diverifikasi. Buka tautan verifikasi yang dikirim ke email kamu, lalu buka undangan ini lagi.'
	}
};

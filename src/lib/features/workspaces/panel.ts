import type { PanelHelpLink } from '$lib/components/panel/panel';
import { WORKSPACE_LIMITS_GUIDE_URL } from '$lib/config/project';

/** The words of the team workspace page (docs/UI_GUIDELINES.md, text budget). */
export const WORKSPACE_PAGE_COPY = {
	panelLabel: 'Bantuan workspace',
	limitsGuide: 'Batas pilot',
	roles: 'Peran',
	rolesTopic: 'peran di workspace',
	limits: 'Cara batas berlaku',
	limitsTopic: 'batas workspace',
	limitsShared:
		'Batas berlaku untuk seluruh workspace, dipakai bersama semua anggota. Admin Sakala bisa memasang profil batas yang lebih besar.',
	team: 'Workspace tim',
	yourRole: 'Peranmu:',
	profile: (name: string) => `profil ${name}`,
	defaultProfile: 'batas bawaan',
	full: 'penuh',
	quotasLabel: 'Pemakaian workspace',
	loadingLimits: 'Memuat batas workspace',
	renameHint: (slug: string) => `Alamat workspace tetap ${slug}.`,
	renameFallback: 'Nama workspace belum tersimpan.',
	noInvitations: 'Belum ada undangan yang menunggu.',
	expiredNote: 'Kirim ulang membuat tautan baru untuk email dan peran yang sama.',
	selfLastOwner: 'Kamu satu-satunya pemilik, jadi peranmu belum bisa diturunkan.',
	leaveTitle: 'Keluar dari workspace',
	leaveBody: 'Akses ke proyek di workspace ini langsung hilang.',
	deleteTitle: 'Hapus workspace',
	deleteBody: 'Anggota dan undangannya ikut hilang.'
} as const;

/** Guides for the Bantuan card; each opens in a new tab. */
export const WORKSPACE_HELP_LINKS: readonly PanelHelpLink[] = [
	{ label: WORKSPACE_PAGE_COPY.limitsGuide, href: WORKSPACE_LIMITS_GUIDE_URL }
];

/** The longest name sakala-api accepts, checked before sending as the create dialog does. */
export const WORKSPACE_NAME_MAX_LENGTH = 100;

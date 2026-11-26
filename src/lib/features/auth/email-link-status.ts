export type EmailLinkStatus = 'success' | 'error' | 'unknown';

/** The API only sends `success` or `error`. Anything else must not read as either. */
export function parseEmailLinkStatus(value: string | null): EmailLinkStatus {
	return value === 'success' || value === 'error' ? value : 'unknown';
}

export type AuthStatusContent = {
	tone: EmailLinkStatus;
	title: string;
	description: string;
};

export const EMAIL_VERIFIED_CONTENT: Record<EmailLinkStatus, AuthStatusContent> = {
	success: {
		tone: 'success',
		title: 'Verifikasi email berhasil',
		description: 'Masuk untuk mulai menyiapkan proyek pertamamu.'
	},
	error: {
		tone: 'error',
		title: 'Tautan verifikasi tidak berlaku',
		description: 'Tautan ini salah atau sudah kedaluwarsa; minta tautan baru di bawah.'
	},
	unknown: {
		tone: 'unknown',
		title: 'Status verifikasi tidak diketahui',
		description: 'Coba masuk; kalau emailmu belum terverifikasi, minta tautan baru di sana.'
	}
};

export const EMAIL_CHANGED_CONTENT: Record<EmailLinkStatus, AuthStatusContent> = {
	success: {
		tone: 'success',
		title: 'Email berhasil diganti',
		description: 'Mulai sekarang, masuk ke Sakala memakai alamat email yang baru.'
	},
	error: {
		tone: 'error',
		title: 'Tautan ganti email tidak berlaku',
		description: 'Tautan ini salah, sudah dipakai, atau kedaluwarsa; minta lagi dari Pengaturan.'
	},
	unknown: {
		tone: 'unknown',
		title: 'Status ganti email tidak diketahui',
		description: 'Cek email akunmu di Pengaturan.'
	}
};

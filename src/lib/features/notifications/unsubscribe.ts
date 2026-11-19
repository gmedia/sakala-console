import { ApiError, NetworkError } from '$lib/api/errors';
import type { EmailNotificationCategory } from '$lib/api/resources/notifications';

/** The names the settings page uses for the same rows. */
export const EMAIL_CATEGORY_LABELS: Record<EmailNotificationCategory, string> = {
	deployment_success: 'Deployment berhasil',
	deployment_failure: 'Deployment gagal',
	project_issue: 'Masalah proyek (aplikasi berhenti sendiri, auto-deploy dilewati)'
};

export function emailCategoryLabel(category: string | null): string | null {
	return category && category in EMAIL_CATEGORY_LABELS
		? EMAIL_CATEGORY_LABELS[category as EmailNotificationCategory]
		: null;
}

/** A link without the fields the API signs cannot be valid; no need to ask. */
export function isCompleteUnsubscribeLink(params: URLSearchParams): boolean {
	return ['category', 'user', 'signature'].every((name) => Boolean(params.get(name)));
}

export type UnsubscribeOutcome =
	| { kind: 'invalid' }
	| { kind: 'account_deleted' }
	| { kind: 'not_emailed' }
	| { kind: 'rate_limited'; retryAfterSeconds?: number }
	| { kind: 'offline' }
	| { kind: 'unknown' };

/** What the API's answer means for the person holding the link. */
export function unsubscribeOutcome(error: unknown): UnsubscribeOutcome {
	if (error instanceof NetworkError) return { kind: 'offline' };
	if (!(error instanceof ApiError)) return { kind: 'unknown' };
	if (error.status === 403) return { kind: 'invalid' };
	if (error.status === 404) return { kind: 'account_deleted' };
	if (error.status === 422) return { kind: 'not_emailed' };
	if (error.isRateLimited)
		return { kind: 'rate_limited', retryAfterSeconds: error.retryAfterSeconds };
	return { kind: 'unknown' };
}

export function unsubscribeOutcomeCopy(outcome: UnsubscribeOutcome): {
	title: string;
	description: string;
	canRetry: boolean;
} {
	switch (outcome.kind) {
		case 'invalid':
			return {
				title: 'Tautan ini tidak bisa dipakai',
				description:
					'Tautannya tidak lengkap atau sudah diubah, jadi emailmu tidak dimatikan. Buka lagi tautan dari email aslinya, atau atur email di pengaturan notifikasi setelah masuk.',
				canRetry: false
			};
		case 'account_deleted':
			return {
				title: 'Akun ini sudah dihapus',
				description:
					'Akun pemilik tautan ini sudah tidak ada, jadi Sakala tidak mengirim email lagi ke sana.',
				canRetry: false
			};
		case 'not_emailed':
			return {
				title: 'Kategori ini tidak diatur lewat email',
				description:
					'Email untuk kategori ini hanya dikirim kalau penting, misalnya perubahan keamanan akun, jadi tidak bisa dimatikan dari sini.',
				canRetry: false
			};
		case 'rate_limited':
			return {
				title: 'Terlalu banyak permintaan',
				description: outcome.retryAfterSeconds
					? `Coba lagi dalam ${outcome.retryAfterSeconds} detik. Emailmu belum dimatikan.`
					: 'Coba lagi sebentar lagi. Emailmu belum dimatikan.',
				canRetry: true
			};
		case 'offline':
			return {
				title: 'Sakala tidak bisa dihubungi',
				description: 'Periksa koneksi internetmu, lalu coba lagi. Emailmu belum dimatikan.',
				canRetry: true
			};
		default:
			return {
				title: 'Emailmu belum dimatikan',
				description: 'Ada kendala di server Sakala. Coba lagi sebentar lagi.',
				canRetry: true
			};
	}
}

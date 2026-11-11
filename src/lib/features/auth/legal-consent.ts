import { ApiError, getFieldError } from '$lib/api/errors';

export const CONSENT_REQUIRED_MESSAGE =
	'Centang pernyataan ini dulu. Akun Sakala hanya bisa dibuat setelah kamu menyetujuinya.';

export const LEGAL_VERSIONS_UNAVAILABLE_MESSAGE =
	'Dokumen yang perlu kamu setujui belum bisa dimuat, jadi permintaan ini belum bisa dikirim.';

const OUTDATED_VERSION_MESSAGE =
	'Syarat Layanan atau Kebijakan Penggunaan Wajar baru saja diperbarui. Baca lagi versi terbarunya, lalu kirim ulang.';

/** The API refuses a version that is not the current one, and the options need reading again. */
export function isOutdatedLegalVersion(error: unknown): boolean {
	return (
		error instanceof ApiError &&
		error.isValidationError &&
		Boolean(error.errors.terms_version?.[0] || error.errors.acceptable_use_version?.[0])
	);
}

/** The message for the checkbox, or nothing when the problem lies elsewhere in the form. */
export function legalConsentError(error: unknown): string | undefined {
	if (isOutdatedLegalVersion(error)) return OUTDATED_VERSION_MESSAGE;
	return getFieldError(error, 'accept_terms') ? CONSENT_REQUIRED_MESSAGE : undefined;
}

/**
 * The reason every admin action asks for, which goes into the audit log. sakala-api accepts
 * up to 500 characters (`reason` rule `max:500` in the admin requests).
 */
export const REASON_MAX = 500;

export const REASON_HINT =
	'Tulis singkat kenapa aksi ini dilakukan. Alasan ini masuk audit log bersama namamu, supaya admin lain bisa menelusurinya.';

/** Why the reason cannot be sent yet, or null. */
export function reasonProblem(reason: string): string | null {
	if (reason.length > REASON_MAX) return `Alasan paling panjang ${REASON_MAX} karakter.`;
	return reason.trim()
		? null
		: 'Alasan belum diisi. Tulis satu kalimat, misalnya permintaan siapa atau masalah apa.';
}

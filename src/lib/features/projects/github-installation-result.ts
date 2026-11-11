export type GithubInstallationResult =
	{ kind: 'connected'; message: string } | { kind: 'error'; message: string };

const FAILURE_MESSAGES: Record<string, string> = {
	github_app_not_configured:
		'GitHub App belum dikonfigurasi di server Sakala ini, jadi pemasangan tidak bisa dimulai. Hubungi admin Sakala, atau pakai Public Git URL untuk repository publik.',
	github_invalid_state:
		'Sesi pemasangan GitHub sudah tidak berlaku. Klik Hubungkan GitHub untuk mengulanginya.',
	github_invalid_installation:
		'GitHub tidak mengirim pemasangan yang bisa dipakai. Kalau kamu memasangnya di organisasi, pemilik organisasi mungkin masih harus menyetujuinya. Setelah disetujui, klik Hubungkan GitHub lagi.',
	github_access_denied:
		'Akun GitHub yang kamu pakai di Sakala tidak punya akses ke pemasangan ini. Pasang lewat akun yang punya akses, lalu coba lagi.',
	github_provider_failure:
		'Sakala gagal menghubungi GitHub, jadi pemasangan belum tersimpan. Coba lagi beberapa saat lagi.'
};

const UNKNOWN_FAILURE_MESSAGE =
	'Pemasangan GitHub belum berhasil. Klik Hubungkan GitHub untuk mencoba lagi.';

/** Reads what the API's setup callback put in the query when it sent the user back to the wizard. */
export function parseGithubInstallationResult(
	params: URLSearchParams
): GithubInstallationResult | null {
	const status = params.get('github_installation');

	if (status === 'connected') {
		return {
			kind: 'connected',
			message: 'GitHub sudah terhubung. Pilih repository yang ingin kamu deploy.'
		};
	}

	if (status === 'error') {
		const code = params.get('error');
		const known = code !== null && Object.hasOwn(FAILURE_MESSAGES, code);
		return { kind: 'error', message: known ? FAILURE_MESSAGES[code] : UNKNOWN_FAILURE_MESSAGE };
	}

	return null;
}

/**
 * One message for "the browser could not reach Sakala", wherever it shows: the account check of
 * every signed-in page, a page whose code could not load, and the project list. The browser
 * cannot tell an offline laptop from an unreachable server, so the text names both and blames
 * neither.
 */
export const CONNECTION_ERROR_COPY = {
	title: 'Tidak dapat terhubung ke server',
	description:
		'Browser ini belum bisa menjangkau Sakala. Periksa koneksi internetmu, lalu coba lagi.'
} as const;

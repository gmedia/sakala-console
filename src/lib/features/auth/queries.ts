import { createQuery } from '@tanstack/svelte-query';
import { queryKeys } from '$lib/api/query-keys';
import { getAuthOptions, getCurrentUser } from '$lib/api/resources/auth';
import { ApiError } from '$lib/api/errors';

/**
 * Cache Policy:
 * - staleTime 5 menit: data dianggap fresh selama 5 menit.
 * - 401 tidak di-retry: 401 berarti tidak ada sesi valid,
 *   mengulang request yang sama tidak akan menghasilkan hasil berbeda.
 * - 429 juga tidak di-retry: AuthGuard menunggu sesuai Retry-After lalu mencoba sendiri.
 * - Error selain 401 dan 429 (403/419/network/5xx) di-retry maksimal 3x: ini
 *   kemungkinan kondisi sementara (server sibuk, koneksi putus sesaat),
 *   jadi masih layak dicoba ulang.
 */
export function useCurrentUser(enabled: boolean | (() => boolean) = true) {
	return createQuery(() => ({
		queryKey: queryKeys.auth.currentUser,
		queryFn: getCurrentUser,
		enabled: typeof enabled === 'function' ? enabled() : enabled,
		retry: (failureCount, error) => {
			if (error instanceof ApiError && (error.isUnauthenticated || error.isRateLimited)) {
				return false;
			}
			return failureCount < 3;
		},
		staleTime: 1000 * 60 * 5
	}));
}

/**
 * Tidak di-retry: kalau gagal, halaman langsung memakai perilaku lama dan API tetap menolak
 * dengan `EMAIL_DELIVERY_UNAVAILABLE`, jadi menunggu retry hanya memperlama skeleton.
 *
 * `retryOnMount: false` juga wajib. Query tanpa data kembali ke `pending` saat di-fetch ulang,
 * jadi component yang baru mount setelah gagal akan membuat halaman kembali ke skeleton, dan
 * skeleton itu melepas component tersebut, berulang terus.
 */
export function useAuthOptions() {
	return createQuery(() => ({
		queryKey: queryKeys.auth.options,
		queryFn: getAuthOptions,
		retry: false,
		retryOnMount: false,
		staleTime: 1000 * 60 * 5
	}));
}

// Alias ekspor jika ada file lain yang terlanjur memanggil nama currentUserQuery
export { useCurrentUser as currentUserQuery };

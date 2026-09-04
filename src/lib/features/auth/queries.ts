import { createQuery } from '@tanstack/svelte-query';
import { queryKeys } from '$lib/api/query-keys';
import { getCurrentUser } from '$lib/api/resources/auth';
import { ApiError } from '$lib/api/errors';

/**
 * Cache Policy:
 * - staleTime 5 menit: data dianggap fresh selama 5 menit.
 * - 401 tidak di-retry: 401 berarti tidak ada sesi valid,
 *   mengulang request yang sama tidak akan menghasilkan hasil berbeda.
 * - Error selain 401 (403/419/network/5xx) di-retry maksimal 3x: ini
 *   kemungkinan kondisi sementara (server sibuk, koneksi putus sesaat),
 *   jadi masih layak dicoba ulang.
 */
export function useCurrentUser(enabled: boolean | (() => boolean) = true) {
	return createQuery(() => ({
		queryKey: queryKeys.auth.currentUser,
		queryFn: getCurrentUser,
		enabled: typeof enabled === 'function' ? enabled() : enabled,
		retry: (failureCount, error) => {
			if (error instanceof ApiError && error.isUnauthenticated) {
				return false;
			}
			return failureCount < 3;
		},
		staleTime: 1000 * 60 * 5
	}));
}

// Alias ekspor jika ada file lain yang terlanjur memanggil nama currentUserQuery
export { useCurrentUser as currentUserQuery };

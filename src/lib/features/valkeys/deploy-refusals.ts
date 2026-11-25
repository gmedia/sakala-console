import { ApiError, VALKEY_ERROR_CODES } from '$lib/api/errors';
import { parseValkeyRefusal } from '$lib/api/resources/valkey-refusals';

/*
 * Kept apart from `presentation.ts`, which pulls in the HTTP client through the Valkey resource:
 * the project's deploy messages read this without it.
 */

/**
 * A deploy refused because of the attached store, in words that say what to do, or `null` for any
 * other refusal. Read by the project's deploy and redeploy controls.
 */
export function valkeyDeployRefusalMessage(error: unknown): string | null {
	if (!(error instanceof ApiError)) return null;
	switch (error.code) {
		case VALKEY_ERROR_CODES.notReady: {
			const details = parseValkeyRefusal('VALKEY_NOT_READY', error.details);
			if (details?.status === 'provisioning') {
				return 'Valkey yang dipasang ke proyek ini masih dibuat. Deploy lagi setelah Valkey-nya siap.';
			}
			return 'Valkey yang dipasang ke proyek ini tidak bisa dipakai. Lepas Valkey itu di tab Variabel, lalu pasang atau buat yang lain.';
		}
		case VALKEY_ERROR_CODES.passwordRotating: {
			const details = parseValkeyRefusal('VALKEY_PASSWORD_ROTATING', error.details);
			const store = details ? `Valkey ${details.valkey.name}` : 'Valkey proyek ini';
			return `Password ${store} sedang diganti dan server belum memastikan password mana yang berlaku, jadi deploy ditunda. Tunggu sebentar lalu deploy lagi. Kalau tetap ditolak, ganti password sekali lagi di halaman Valkey itu.`;
		}
		case VALKEY_ERROR_CODES.nodeMismatch: {
			const details = parseValkeyRefusal('VALKEY_NODE_MISMATCH', error.details);
			const store = details ? `Valkey ${details.valkey.name}` : 'Valkey yang dipasang';
			return `Proyek ini berjalan di server lain, sedangkan ${store} hanya bisa dijangkau dari server tempatnya berada. Lepas Valkey itu di tab Variabel, lalu buat Valkey baru untuk proyek ini.`;
		}
	}
	return null;
}

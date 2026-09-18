import type { RuntimeStatus } from './type';
import { ApiError, NetworkError } from '$lib/api/errors';

export type ProjectListErrorState = 'unauthenticated' | 'network' | 'server' | 'unknown';

const runtimeStatuses = [
	'not_deployed',
	'deploying',
	'running',
	'stopped',
	'failed',
	'crashed'
] as const;

export function toRuntimeStatus(value: string): RuntimeStatus | null {
	if ((runtimeStatuses as readonly string[]).includes(value)) {
		return value as RuntimeStatus;
	}

	return null;
}

export type ProjectListErrorPresentation = {
	title: string;
	description: string;
	action: 'login' | 'retry';
};

export function getProjectListErrorPresentation(error: unknown): ProjectListErrorPresentation {
	if (error instanceof ApiError) {
		if (error.isUnauthenticated) {
			return {
				title: 'Sesi sudah tidak valid',
				description: 'Sesi kamu sudah berakhir. Silakan login kembali untuk melihat project.',
				action: 'login'
			};
		}

		if (error.isServerError) {
			return {
				title: 'Server sedang bermasalah',
				description: 'Terjadi masalah pada server saat mengambil data project. Silakan coba lagi.',
				action: 'retry'
			};
		}
	}

	if (error instanceof NetworkError) {
		return {
			title: 'Tidak dapat terhubung ke server',
			description: 'API tidak dapat dijangkau. Periksa koneksi internetmu lalu coba lagi.',
			action: 'retry'
		};
	}

	return {
		title: 'Gagal memuat project',
		description: 'Terjadi kendala saat mengambil data project. Silakan coba lagi.',
		action: 'retry'
	};
}

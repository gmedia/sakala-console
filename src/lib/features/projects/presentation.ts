import { ApiError, NetworkError } from '$lib/api/errors';
import type { RuntimeStatus } from '$lib/api/resources/projects';

export type RuntimeStatusPresentation = {
	label: string;
	variant: 'neutral' | 'success' | 'error' | 'warning' | 'info' | 'muted';
};

export const runtimeStatusPresentation: Record<RuntimeStatus, RuntimeStatusPresentation> = {
	running: {
		label: 'Live',
		variant: 'success'
	},
	failed: {
		label: 'Gagal',
		variant: 'error'
	},
	stopped: {
		label: 'Berhenti',
		variant: 'muted'
	},
	crashed: {
		label: 'Gagal',
		variant: 'error'
	},
	deploying: {
		label: 'Mendeploy',
		variant: 'warning'
	},
	not_deployed: {
		label: 'Belum Deploy',
		variant: 'muted'
	}
};

const knownRuntimeStatuses = [
	'not_deployed',
	'deploying',
	'running',
	'stopped',
	'failed',
	'crashed'
] as const;

export type ProjectListErrorState = 'unauthenticated' | 'network' | 'server' | 'unknown';

export type ProjectListErrorPresentation = {
	title: string;
	description: string;
	action: 'login' | 'retry';
};

export function toRuntimeStatus(value: string): RuntimeStatus | null {
	if ((knownRuntimeStatuses as readonly string[]).includes(value)) {
		return value as RuntimeStatus;
	}

	return null;
}

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

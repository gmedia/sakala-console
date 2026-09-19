import { describe, expect, it } from 'vitest';
import {
	getProjectListErrorPresentation,
	runtimeStatusPresentation,
	toRuntimeStatus
} from './presentation';
import { apiErrorFromResponse, NetworkError } from '$lib/api/errors';

describe('runtimeStatusPresentation', () => {
	it.each([
		['running', 'Live', 'success'],
		['failed', 'Gagal', 'error'],
		['stopped', 'Berhenti', 'muted'],
		['crashed', 'Gagal', 'error'],
		['deploying', 'Mendeploy', 'warning'],
		['not_deployed', 'Belum Deploy', 'muted']
	] as const)('memiliki presentation untuk status %s', (status, label, variant) => {
		expect(runtimeStatusPresentation[status]).toEqual({
			label,
			variant
		});
	});
});

describe('toRuntimeStatus', () => {
	it.each(['not_deployed', 'deploying', 'running', 'stopped', 'failed', 'crashed'])(
		'menerima runtime status yang dikenal: %s',
		(status) => {
			expect(toRuntimeStatus(status)).toBe(status);
		}
	);

	it('mengembalikan null untuk runtime status yang belum dikenal frontend', () => {
		expect(toRuntimeStatus('maintenance')).toBeNull();
	});
});

describe('getProjectListErrorPresentation', () => {
	it('memetakan 401 ke action login', () => {
		const error = apiErrorFromResponse(401);

		expect(getProjectListErrorPresentation(error)).toEqual({
			title: 'Sesi sudah tidak valid',
			description: 'Sesi kamu sudah berakhir. Silakan login kembali untuk melihat project.',
			action: 'login'
		});
	});

	it('memetakan NetworkError ke action retry', () => {
		const error = new NetworkError();

		expect(getProjectListErrorPresentation(error)).toEqual({
			title: 'Tidak dapat terhubung ke server',
			description: 'API tidak dapat dijangkau. Periksa koneksi internetmu lalu coba lagi.',
			action: 'retry'
		});
	});

	it('memetakan 5xx ke action retry', () => {
		const error = apiErrorFromResponse(500);

		expect(getProjectListErrorPresentation(error)).toEqual({
			title: 'Server sedang bermasalah',
			description: 'Terjadi masalah pada server saat mengambil data project. Silakan coba lagi.',
			action: 'retry'
		});
	});
});

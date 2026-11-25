import { describe, expect, it } from 'vitest';
import { ApiError } from '$lib/api/errors';
import { parsePilotLimitsResponse } from '$lib/api/resources/pilot-limits';
import { parseValkey, parseValkeyList, type Valkey } from '$lib/api/resources/valkeys';
import { getDeployErrorMessage } from '$lib/features/projects/presentation';
import { errorFromValkeyFixture, getValkeyFixture } from '$lib/testing/valkey-fixtures';
import {
	PASSWORD_ROTATION_COPY,
	QUOTA_COPY,
	VALKEY_TRANSITION_POLL_MS,
	PASSWORD_ROTATION_POLL_MS,
	canOfferProjectValkey,
	passwordRotationView,
	resolveValkeyPollInterval,
	separateFailure,
	sizeOptions,
	valkeyDeployRefusalMessage,
	valkeyEnvBlock,
	valkeyErrorMessage,
	valkeyMemoryMeter,
	valkeyMemoryNotice,
	valkeyQuota,
	valkeySizes,
	valkeyStatusView,
	valkeysEnabled,
	valkeysInUse,
	valkeysUnavailable,
	valkeyModeView
} from './presentation';
import { laravelSuggestionState, valkeyVariableRows } from './project-variables';

const limits = (name: string) => parsePilotLimitsResponse(getValkeyFixture(name).body);
const show = (name: string) => parseValkey(getValkeyFixture(name).body);
const MB = 1024 * 1024;

describe('when Valkey appears', () => {
	it('shows nothing while the server flag is off, even with a quota', () => {
		const off = limits('pilot-limits-valkeys-off');
		expect(valkeysEnabled(off)).toBe(false);
		expect(valkeysInUse({ ...off, quotas: { ...off.quotas, max_valkeys: 2 } })).toBe(false);
		expect(valkeysUnavailable(off)).toBe(false);
		expect(canOfferProjectValkey(off)).toBe(false);
		// An API from before Valkey sends no `valkeys` at all.
		expect(valkeysInUse({ quotas: { max_valkeys: 2 } })).toBe(false);
		expect(valkeysInUse(undefined)).toBe(false);
	});

	it('shows the menu only to a workspace opened for Valkey or holding one', () => {
		expect(valkeysInUse(limits('pilot-limits-valkeys-zero'))).toBe(false);
		expect(valkeysInUse(limits('pilot-limits-valkeys-empty'))).toBe(true);
		const zero = limits('pilot-limits-valkeys-zero');
		expect(valkeysInUse({ ...zero, quotas: { ...zero.quotas, current_valkeys_count: 1 } })).toBe(
			true
		);
	});

	it('says when no node takes a store, and offers one to a project only when it can work', () => {
		expect(valkeysUnavailable(limits('pilot-limits-valkeys-unavailable'))).toBe(true);
		expect(canOfferProjectValkey(limits('pilot-limits-valkeys-unavailable'))).toBe(false);
		expect(canOfferProjectValkey(limits('pilot-limits-valkeys-empty'))).toBe(true);
		// 3 of 3 stores and 160 of 160 MB.
		expect(canOfferProjectValkey(limits('pilot-limits-valkeys'))).toBe(false);
	});
});

describe('quota and sizes', () => {
	it('summarises the count and the reserved memory, and why a new store is refused', () => {
		const full = valkeyQuota(limits('pilot-limits-valkeys').quotas);
		expect(full?.count.label).toBe('3 dari 3 Valkey');
		expect(full?.memory.label).toBe('dicadangkan 160 MB dari 160 MB');
		expect(full?.blockedReason).toBe(QUOTA_COPY.countFull(3));
		expect(valkeyQuota(limits('pilot-limits-valkeys-zero').quotas)?.blockedReason).toBe(
			QUOTA_COPY.disabled
		);
		const empty = valkeyQuota(limits('pilot-limits-valkeys-empty').quotas);
		expect(empty).toMatchObject({ remainingMb: 160, blockedReason: null });
		expect(
			valkeyQuota({
				max_valkeys: 3,
				current_valkeys_count: 1,
				max_valkey_memory_mb: 64,
				current_valkey_memory_mb: 64
			})?.blockedReason
		).toBe(QUOTA_COPY.memoryFull);
		expect(valkeyQuota({})).toBeNull();
	});

	it('offers the server sizes, disabling those past what is left, with the store own size for a resize', () => {
		expect(valkeySizes(limits('pilot-limits-valkeys-off'))).toEqual([32, 64, 128]);
		expect(valkeySizes(undefined)).toEqual([32, 64, 128]);
		const create = sizeOptions([32, 64, 128], 64);
		expect(create.map((option) => option.disabled)).toEqual([false, false, true]);
		expect(create[2].reason).toMatch(/sisa jatah memori workspace \(64 MB\)/);
		expect(sizeOptions([32, 64, 128], 64, 64).map((option) => option.disabled)).toEqual([
			false,
			false,
			false
		]);
		expect(sizeOptions([32, 64, 128], null).every((option) => !option.disabled)).toBe(true);
	});
});

describe('memory', () => {
	it('warns at 80 % in the words of the mode, and never calls a full cache an error', () => {
		const cache = show('valkey-show-cache');
		expect(cache.usage.used_memory_bytes).toBe(27 * MB);
		expect(valkeyMemoryMeter(cache)).toMatchObject({ level: 'warning', label: '27 MB dari 32 MB' });
		expect(valkeyMemoryNotice(cache)?.text).toMatch(/wajar untuk cache/);

		const queue = show('valkey-show');
		expect(valkeyMemoryNotice(queue)).toBeNull();
		const nearlyFull: Valkey = { ...queue, usage: { ...queue.usage, used_memory_bytes: 60 * MB } };
		expect(valkeyMemoryNotice(nearlyFull)?.text).toMatch(/termasuk job antrean baru/);
		const full: Valkey = { ...queue, usage: { ...queue.usage, used_memory_bytes: 64 * MB } };
		expect(valkeyMemoryMeter(full).level).toBe('full');
		expect(valkeyMemoryNotice(full)).toMatchObject({ level: 'full' });
		const fullCache: Valkey = { ...cache, usage: { ...cache.usage, used_memory_bytes: 32 * MB } };
		expect(valkeyMemoryMeter(fullCache).level).toBe('warning');
		expect(valkeyMemoryNotice(fullCache)).toMatchObject({ level: 'warning' });
		expect(valkeyMemoryNotice(show('valkey-create'))).toBeNull();
	});
});

describe('status and mode', () => {
	it('explains a locked store, its data, and both reasons it can be locked', () => {
		const locked = show('valkey-show-locked');
		const view = valkeyStatusView(locked);
		expect(view).toMatchObject({ label: 'Dikunci', tone: 'warning' });
		expect(view.description).toMatch(/error autentikasi/);
		expect(view.description).toMatch(/backup tetap berjalan/);
		expect(valkeyStatusView({ ...locked, mode: 'cache' }).description).not.toMatch(/backup/);
	});

	it('explains a failed creation with the API summary, and keeps it out of the separate failure', () => {
		const failed = show('valkey-show-failed');
		expect(valkeyStatusView(failed).description).toMatch(
			/tidak punya cukup ruang memori.*Hapus Valkey ini lalu buat lagi\.$/
		);
		expect(separateFailure(failed)).toBeNull();
		expect(separateFailure(show('valkey-show-resize-failed'))?.code).toBe(
			'valkey_size_below_usage'
		);
	});

	it('shows an unknown status or mode as itself', () => {
		expect(valkeyStatusView({ status: 'migrating', last_failure: null }).label).toBe('migrating');
		expect(valkeyModeView('lfu').label).toBe('lfu');
		expect(valkeyModeView('persistent').useFor).toMatch(/BullMQ/);
	});
});

describe('password rotation and polling', () => {
	it('reads a completed rotation with its redeploys, and an unknown one', () => {
		const completed = passwordRotationView(
			show('valkey-show-rotation-completed'),
			new Date('2026-11-25T03:20:00Z')
		);
		expect(completed).toMatchObject({ state: 'completed', queueing: false });
		expect(completed?.state === 'completed' && completed.redeploys.size).toBe(1);
		expect(passwordRotationView(show('valkey-show-rotation-unknown'))).toEqual({
			state: 'unknown'
		});
		expect(PASSWORD_ROTATION_COPY.rotateBody).toMatch(/setelah di-redeploy/);
	});

	it('polls fast while a rotation settles, slower while the node works, and not otherwise', () => {
		expect(resolveValkeyPollInterval([show('rotate-password-redeploy')])).toBe(
			PASSWORD_ROTATION_POLL_MS
		);
		expect(resolveValkeyPollInterval([show('valkey-create')])).toBe(VALKEY_TRANSITION_POLL_MS);
		expect(resolveValkeyPollInterval([show('valkey-show-pending-resize')])).toBe(
			VALKEY_TRANSITION_POLL_MS
		);
		expect(resolveValkeyPollInterval(parseValkeyList(getValkeyFixture('valkeys').body))).toBe(
			false
		);
	});
});

describe('variables', () => {
	it('writes the env block in the API order', () => {
		const block = valkeyEnvBlock({
			REDIS_PASSWORD: 'p',
			EXTRA: 'x',
			REDIS_URL: 'redis://:p@10.213.0.2:6379',
			REDIS_HOST: '10.213.0.2',
			REDIS_PORT: '6379'
		});
		expect(block.split('\n').map((line) => line.split('=')[0])).toEqual([
			'REDIS_URL',
			'REDIS_HOST',
			'REDIS_PORT',
			'REDIS_PASSWORD',
			'EXTRA'
		]);
	});

	it('marks the variable a project overrides, from the project resource', () => {
		const project = getValkeyFixture('project-with-valkey-overridden').body as {
			data: { valkeys: Parameters<typeof valkeyVariableRows>[0][] };
		};
		expect(valkeyVariableRows(project.data.valkeys[0])).toEqual([
			{ name: 'REDIS_URL', overridden: true },
			{ name: 'REDIS_HOST', overridden: false },
			{ name: 'REDIS_PORT', overridden: false },
			{ name: 'REDIS_PASSWORD', overridden: false }
		]);
	});

	it('tells which Laravel variables are missing and which point elsewhere', () => {
		const state = laravelSuggestionState(
			new Map([
				['QUEUE_CONNECTION', 'database'],
				['APP_KEY', null]
			])
		);
		expect(state.missing.map((item) => item.key)).toEqual(['CACHE_STORE']);
		expect(state.different).toEqual([
			{ key: 'QUEUE_CONNECTION', value: 'redis', current: 'database' }
		]);
		expect(
			laravelSuggestionState(
				new Map([
					['QUEUE_CONNECTION', 'redis'],
					['CACHE_STORE', 'redis']
				])
			)
		).toEqual({ missing: [], different: [] });
	});
});

describe('refusals in words', () => {
	const message = (name: string, action: Parameters<typeof valkeyErrorMessage>[1]) =>
		valkeyErrorMessage(errorFromValkeyFixture(name), action, 'fallback');

	it('rebuilds the quota refusals from their numbers', () => {
		expect(message('valkey-create-limit', 'create')).toBe(QUOTA_COPY.countFull(3));
		expect(message('valkey-create-limit-zero', 'create')).toBe(QUOTA_COPY.disabled);
		expect(message('valkey-create-memory-limit', 'create')).toBe(
			'Ukuran 128 MB melebihi sisa jatah memori Valkey workspace ini, 64 MB dari 160 MB. Pilih ukuran yang lebih kecil, kecilkan atau hapus Valkey lain, atau minta admin Sakala menaikkan jatahnya.'
		);
		expect(message('valkey-resize-memory-limit', 'resize')).toMatch(/32 MB dari 160 MB/);
	});

	it('says what to do for node, capacity, and state refusals', () => {
		expect(message('valkey-create-unavailable', 'create')).toMatch(/Pilih region lain/);
		expect(message('valkey-create-capacity-unavailable', 'create')).toMatch(
			/ukuran yang lebih kecil/
		);
		expect(message('attach-node-mismatch', 'attach')).toBe(
			'Proyek ini berjalan di server lain, sedangkan Valkey antrean-toko hanya bisa dijangkau dari server tempatnya berada. Buat Valkey baru untuk proyek ini.'
		);
		expect(message('attach-project-already-attached', 'attach')).toMatch(
			/sudah memakai Valkey antrean-toko/
		);
		expect(message('attach-not-ready', 'attach')).toMatch(/masih dibuat/);
		expect(message('attach-locked', 'attach')).toMatch(/dikunci/);
		expect(message('valkey-delete-in-use', 'delete')).toBe(
			'Valkey ini masih dipasang ke toko-kopi-web. Lepas dari semua proyek dulu, lalu hapus.'
		);
		expect(message('rotate-password-busy', 'rotate')).toMatch(/Penggantian password sebelumnya/);
		expect(message('valkey-resize-busy', 'resize')).toMatch(/Perubahan sebelumnya/);
		expect(message('credentials-password-rotating', 'credentials')).toMatch(
			/belum bisa ditampilkan/
		);
		expect(message('credentials-not-ready', 'credentials')).toMatch(/setelah Valkey siap/);
	});

	it('names who may act on a 403 and what is gone on a 404', () => {
		expect(message('credentials-member', 'credentials')).toBe(
			'Password hanya bisa dilihat pemilik workspace.'
		);
		expect(message('valkey-create-viewer', 'create')).toMatch(/pemilik dan anggota/);
		expect(message('valkeys-off', 'load')).toMatch(/tidak ada di workspace ini/);
		expect(message('detach-not-attached', 'detach')).toMatch(/sudah tidak terpasang/);
	});

	it('explains deploys refused because of the attached store, and leaves others alone', () => {
		expect(getDeployErrorMessage(errorFromValkeyFixture('deploy-node-mismatch'), 'x')).toMatch(
			/Lepas Valkey itu di tab Variabel/
		);
		expect(getDeployErrorMessage(errorFromValkeyFixture('deploy-password-rotating'), 'x')).toMatch(
			/Password Valkey antrean-toko-kopi sedang diganti/
		);
		expect(getDeployErrorMessage(errorFromValkeyFixture('deploy-valkey-not-ready'), 'x')).toMatch(
			/masih dibuat/
		);
		expect(valkeyDeployRefusalMessage(new ApiError('Lain', 409))).toBeNull();
		expect(valkeyDeployRefusalMessage(new Error('x'))).toBeNull();
	});
});

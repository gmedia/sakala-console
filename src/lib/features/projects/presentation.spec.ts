import { describe, expect, it } from 'vitest';
import {
	deriveProjectHeaderState,
	findLatestFailedDeployment,
	getDeploymentCardNote,
	getDeploymentBadge,
	getFrameworkLabel,
	getProjectListErrorPresentation,
	getProjectListStatusPresentation,
	getProjectPublicUrl,
	getPublicUrlLabel,
	runtimeStatusPresentation,
	toRuntimeStatus,
	formatPilotRuntime,
	getPortDisplay,
	getActiveDeploymentLimitNotice,
	getProjectQuotaNotice,
	getProjectWakeErrorMessage,
	getSleepingNotice,
	isListedProjectUrlReachable,
	isProjectQuotaReached,
	isProjectServing,
	PROJECT_WAKE_COPY
} from './presentation';
import {
	apiErrorFromResponse,
	NetworkError,
	PROJECT_NOT_SLEEPING,
	PROJECT_SUSPENDED,
	PROJECT_WAKE_LIMIT_EXCEEDED
} from '$lib/api/errors';

describe('runtimeStatusPresentation', () => {
	it.each([
		['running', 'Live', 'success'],
		['failed', 'Gagal', 'error'],
		['stopped', 'Berhenti', 'muted'],
		['crashed', 'Crash', 'error'],
		['deploying', 'Men-deploy', 'running'],
		['not_deployed', 'Belum deploy', 'muted'],
		['sleeping', 'Tidur', 'muted']
	] as const)('memiliki presentation untuk status %s', (status, label, variant) => {
		expect(runtimeStatusPresentation[status]).toEqual({
			label,
			variant
		});
	});
});

describe('getProjectListStatusPresentation', () => {
	const suspension = { reason: 'Penambangan kripto', suspended_at: '2026-11-10T00:00:00Z' };

	it.each(['running', 'stopped', 'deploying', 'maintenance'])(
		'a suspended project reads Ditangguhkan whatever its runtime is (%s)',
		(runtime_status) => {
			expect(getProjectListStatusPresentation({ runtime_status, suspension })).toEqual({
				label: 'Ditangguhkan',
				variant: 'warning'
			});
		}
	);

	it('a suspension without a record still counts as suspended', () => {
		expect(
			getProjectListStatusPresentation({
				runtime_status: 'running',
				suspension: { reason: null, suspended_at: null }
			}).label
		).toBe('Ditangguhkan');
	});

	it('matches the label the project header shows', () => {
		const header = deriveProjectHeaderState({
			status: 'suspended',
			runtime_status: 'running',
			active_deployment_id: 'dep_1'
		});

		expect(getProjectListStatusPresentation({ runtime_status: 'running', suspension }).label).toBe(
			header.badge.label
		);
	});

	it('falls back to the runtime status when the project is not suspended', () => {
		expect(
			getProjectListStatusPresentation({ runtime_status: 'running', suspension: null }).label
		).toBe('Live');
		expect(
			getProjectListStatusPresentation({ runtime_status: 'maintenance', suspension: null }).label
		).toBe('Lainnya');
	});

	it('a sleeping project reads Tidur, calm rather than a warning', () => {
		expect(
			getProjectListStatusPresentation({ runtime_status: 'sleeping', suspension: null })
		).toEqual({ label: 'Tidur', variant: 'muted' });
	});
});

describe('toRuntimeStatus', () => {
	it.each(['not_deployed', 'deploying', 'running', 'stopped', 'failed', 'crashed', 'sleeping'])(
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
			description: 'Sesi kamu sudah berakhir. Silakan masuk kembali untuk melihat proyek.',
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
			description: 'Terjadi masalah pada server saat mengambil data proyek. Silakan coba lagi.',
			action: 'retry'
		});
	});
});

describe('findLatestFailedDeployment', () => {
	it('picks the failed deployment with the highest sequence', () => {
		const result = findLatestFailedDeployment([
			{ id: 'a', status: 'succeeded', sequence: 5 },
			{ id: 'b', status: 'failed', sequence: 3 },
			{ id: 'c', status: 'failed', sequence: 4 }
		] as never);

		expect(result).toMatchObject({ id: 'c' });
	});

	it('returns null when the list has no failed deployment', () => {
		expect(findLatestFailedDeployment([])).toBeNull();
		expect(
			findLatestFailedDeployment([{ id: 'a', status: 'cancelled', sequence: 1 }] as never)
		).toBeNull();
	});
});

describe('deriveProjectHeaderState', () => {
	const live = {
		status: 'active',
		runtime_status: 'running',
		active_deployment_id: 'dep_1'
	} as const;
	const attempt = (status: string, sequence = 2, extra: object = {}) =>
		({
			id: `dep_${sequence}`,
			status,
			sequence,
			queue_state: null,
			cancel_requested_at: null,
			...extra
		}) as Parameters<typeof deriveProjectHeaderState>[1] extends readonly (infer T)[] | undefined
			? T
			: never;

	it('not_deployed: asks for the first deploy, with no draft badge', () => {
		const state = deriveProjectHeaderState({
			status: 'draft',
			runtime_status: 'not_deployed',
			active_deployment_id: null
		});

		expect(state.kind).toBe('not_deployed');
		expect(state.badge.label).toBe('Belum deploy');
		expect(state.serving).toBe(false);
		expect(state.showRedeploy).toBe(true);
	});

	it.each(['not_deployed', 'failed', 'deploying', 'running', 'stopped', 'crashed'])(
		'never claims Draft while runtime says %s',
		(runtime_status) => {
			const state = deriveProjectHeaderState({
				status: 'draft',
				runtime_status: runtime_status as never,
				active_deployment_id: null
			});

			expect(state.badge.label).not.toBe('Draft');
		}
	);

	it('a queued attempt counts as deploying before runtime_status moves', () => {
		const state = deriveProjectHeaderState(
			{ status: 'draft', runtime_status: 'not_deployed', active_deployment_id: null },
			[attempt('queued', 1)]
		);

		expect(state.kind).toBe('deploying');
		expect(state.badge.label).toBe('Men-deploy');
		expect(state.redeployBusy).toBe(true);
		expect(state.serving).toBe(false);
		expect(state.notice?.message).toBe('Deployment #1 mengantre.');
		expect(state.notice?.link).toMatchObject({ label: 'Lihat progres', deploymentId: 'dep_1' });
	});

	it('explains a queue with no node, without promising a time', () => {
		const state = deriveProjectHeaderState(live, [
			attempt('queued', 2, { queue_state: 'waiting_for_node' })
		]);

		expect(state.notice?.message).toContain('belum ada server Sakala yang siap');
		expect(state.notice?.message).toContain('Versi sebelumnya masih melayani');
	});

	it('deploying on top of a live version keeps the URL', () => {
		const state = deriveProjectHeaderState(
			{ status: 'active', runtime_status: 'deploying', active_deployment_id: 'dep_1' },
			[attempt('building')]
		);

		expect(state.serving).toBe(true);
		expect(state.notice?.message).toBe(
			'Deployment #2 sedang berjalan, tahap Build proyek. Versi sebelumnya masih melayani.'
		);
	});

	it('deploying the first version shows no URL', () => {
		const state = deriveProjectHeaderState(
			{ status: 'draft', runtime_status: 'deploying', active_deployment_id: null },
			[attempt('building', 1)]
		);

		expect(state.serving).toBe(false);
		expect(state.notice?.message).not.toContain('Versi sebelumnya');
	});

	it('a failed attempt over a live version says the previous one still serves', () => {
		const state = deriveProjectHeaderState(live, [
			attempt('succeeded', 1, { id: 'dep_1' }),
			attempt('failed', 2)
		]);

		expect(state.kind).toBe('live_failed_attempt');
		expect(state.badge.label).toBe('Live');
		expect(state.serving).toBe(true);
		expect(state.notice?.message).toBe('Deployment #2 gagal. Versi sebelumnya masih melayani.');
		expect(state.notice?.link).toMatchObject({ label: 'Lihat log', toLogs: true });
	});

	it('an older failure does not raise a notice once a newer deployment succeeded', () => {
		const state = deriveProjectHeaderState(live, [
			attempt('failed', 1),
			attempt('succeeded', 2, { id: 'dep_1' })
		]);

		expect(state.kind).toBe('live');
		expect(state.notice).toBeNull();
	});

	it('crashed: not Live, no URL, and says what to do', () => {
		const state = deriveProjectHeaderState({ ...live, runtime_status: 'crashed' });

		expect(state.kind).toBe('crashed');
		expect(state.badge.label).toBe('Crash');
		expect(state.serving).toBe(false);
		expect(state.notice?.message).toContain('perbaiki, lalu redeploy');
		expect(state.notice?.link).toMatchObject({ deploymentId: 'dep_1', toLogs: true });
	});

	it('stopped: no URL, and Redeploy brings it back', () => {
		const state = deriveProjectHeaderState({ ...live, runtime_status: 'stopped' });

		expect(state.kind).toBe('stopped');
		expect(state.serving).toBe(false);
		expect(state.showRedeploy).toBe(true);
	});

	it('failed with nothing live keeps the no-URL message', () => {
		const state = deriveProjectHeaderState(
			{ status: 'draft', runtime_status: 'failed', active_deployment_id: null },
			[attempt('failed', 1)]
		);

		expect(state.kind).toBe('failed');
		expect(state.notice?.message).toContain('belum ada URL publik');
		expect(state.notice?.link?.deploymentId).toBe('dep_1');
	});

	it('sleeping: not Live, keeps the URL, offers Bangunkan, and says it is normal', () => {
		const state = deriveProjectHeaderState({ ...live, runtime_status: 'sleeping' }, [], {
			idleSleepMinutes: 30
		});

		expect(state.kind).toBe('sleeping');
		expect(state.badge).toEqual({ label: 'Tidur', variant: 'muted' });
		expect(state.serving).toBe(false);
		expect(state.showUrl).toBe(true);
		expect(state.showWake).toBe(true);
		expect(state.showRedeploy).toBe(true);
		expect(state.notice).toEqual({
			tone: 'sleeping',
			message:
				'Proyek ini sedang tidur karena tidak ada pengunjung selama 30 menit. Ini normal: proyek menyala lagi saat URL-nya dibuka.'
		});
	});

	it('sleeping without a known idle window leaves the number out', () => {
		const state = deriveProjectHeaderState({ ...live, runtime_status: 'sleeping' });

		expect(state.notice?.message).toBe(getSleepingNotice());
		expect(state.notice?.message).toContain('lama tidak ada pengunjung');
		expect(state.notice?.message).not.toMatch(/\d/);
	});

	it('a deployment started while asleep reads as deploying, without Bangunkan', () => {
		const state = deriveProjectHeaderState({ ...live, runtime_status: 'sleeping' }, [
			attempt('building')
		]);

		expect(state.kind).toBe('deploying');
		expect(state.showWake).toBe(false);
	});

	it('only a sleeping project offers Bangunkan', () => {
		for (const runtime_status of ['running', 'stopped', 'crashed', 'failed'] as const) {
			expect(deriveProjectHeaderState({ ...live, runtime_status }).showWake).toBe(false);
		}
	});

	it('suspended wins over sleeping: no Bangunkan and no URL', () => {
		const state = deriveProjectHeaderState({
			...live,
			status: 'suspended',
			runtime_status: 'sleeping'
		});

		expect(state.kind).toBe('suspended');
		expect(state.showWake).toBe(false);
		expect(state.showUrl).toBeUndefined();
	});

	it('suspended: no Redeploy, says why, and wins over everything else', () => {
		const state = deriveProjectHeaderState({ ...live, status: 'suspended' }, [attempt('building')]);

		expect(state.kind).toBe('suspended');
		expect(state.showRedeploy).toBe(false);
		expect(state.serving).toBe(false);
		expect(state.notice?.message).toContain('ditangguhkan oleh admin');
	});
});

describe('getProjectPublicUrl', () => {
	it('uses what the API sends, keeping its scheme and port', () => {
		expect(getProjectPublicUrl({ public_url: 'http://app.apps.localhost:8080' })).toBe(
			'http://app.apps.localhost:8080'
		);
		expect(getProjectPublicUrl({ public_url: 'https://app.example.test' })).toBe(
			'https://app.example.test'
		);
	});

	it('does not invent a URL from nothing', () => {
		expect(getProjectPublicUrl(null)).toBeNull();
		expect(getProjectPublicUrl({})).toBeNull();
		expect(getProjectPublicUrl({ public_url: null })).toBeNull();
		expect(getProjectPublicUrl({ public_url: '' })).toBeNull();
		expect(getProjectPublicUrl({ public_url: 'https://' })).toBeNull();
		expect(getProjectPublicUrl({ public_url: 'http://:8080' })).toBeNull();
	});

	it('never links to something that is not a web address', () => {
		expect(getProjectPublicUrl({ public_url: 'javascript:alert(1)' })).toBeNull();
		expect(getProjectPublicUrl({ public_url: 'app.example.test' })).toBeNull();
	});
});

describe('getPublicUrlLabel', () => {
	it('drops the scheme and keeps the port', () => {
		expect(getPublicUrlLabel('http://app.apps.localhost:8080')).toBe('app.apps.localhost:8080');
	});
});

describe('deployment card copy', () => {
	const base = { failure: null, queue_state: null, cancel_requested_at: null } as const;

	it.each([
		['queued', 'Mengantre', 'queued'],
		['building', 'Men-deploy', 'running'],
		['health_checking', 'Men-deploy', 'running'],
		['succeeded', 'Berhasil', 'success'],
		['failed', 'Gagal', 'error'],
		['cancelled', 'Dibatalkan', 'muted']
	])('labels %s in Indonesian, and queued is not deploying', (status, label, variant) => {
		expect(getDeploymentBadge(status)).toEqual({ label, variant });
	});

	it('does not call a cancelled deployment a build error', () => {
		expect(getDeploymentCardNote({ ...base, status: 'cancelled' })).toBe(
			'Dibatalkan sebelum selesai'
		);
	});

	it('names the stage a deployment failed at, not always build', () => {
		const failure = {
			code: 'x',
			category: 'health',
			summary: 's',
			recovery_hint: 'h',
			user_fixable: true,
			detail: null,
			stage: 'health_checking'
		} as const;

		expect(getDeploymentCardNote({ ...base, status: 'failed', failure })).toBe(
			'Gagal di tahap Mengecek aplikasi'
		);
		expect(getDeploymentCardNote({ ...base, status: 'failed' })).not.toContain('Build');
	});

	it('leaves a finished deployment to its duration', () => {
		expect(getDeploymentCardNote({ ...base, status: 'succeeded' })).toBeNull();
	});
});

describe('pilot limits', () => {
	const quotas = {
		max_projects_per_user: 3,
		max_active_deployments_per_user: 2,
		max_active_deployments_per_project: 1,
		current_projects_count: 1,
		current_active_deployments_count: 0
	};

	it('says how much of the project quota is used', () => {
		const notice = getProjectQuotaNotice({ quotas });

		expect(notice.reached).toBe(false);
		expect(notice.message).toContain('1 dari 3');
	});

	it('says the quota is used up, and what frees it', () => {
		const notice = getProjectQuotaNotice({ quotas: { ...quotas, current_projects_count: 3 } });

		expect(notice.reached).toBe(true);
		expect(notice.message).toContain('3 dari 3');
		expect(notice.message).toContain('Hapus proyek');
	});

	it('names a team workspace, whose quota its members share', () => {
		const used = getProjectQuotaNotice({ quotas }, 'Tim Facility');
		expect(used).toEqual({
			reached: false,
			message: 'Workspace Tim Facility memakai 1 dari 3 proyek, dibagi untuk semua anggotanya.'
		});

		const full = getProjectQuotaNotice(
			{ quotas: { ...quotas, current_projects_count: 3 } },
			'Tim Facility'
		);
		expect(full.reached).toBe(true);
		expect(full.message).toContain('workspace Tim Facility');
		expect(full.message).toContain('profil batas');
		expect(
			getActiveDeploymentLimitNotice({ ...quotas, current_active_deployments_count: 2 }, 'Tim')
		).toContain('Workspace Tim sudah punya 2 deployment');
	});

	it('blocks only at the limit, and never without data', () => {
		expect(isProjectQuotaReached(undefined)).toBe(false);
		expect(isProjectQuotaReached(quotas)).toBe(false);
		expect(isProjectQuotaReached({ ...quotas, current_projects_count: 3 })).toBe(true);
	});

	it('warns about running deployments only at the limit', () => {
		expect(getActiveDeploymentLimitNotice(quotas)).toBeNull();
		expect(
			getActiveDeploymentLimitNotice({ ...quotas, current_active_deployments_count: 2 })
		).toContain('batasnya 2');
	});

	it('writes the runtime limits with units', () => {
		expect(
			formatPilotRuntime({
				runtime_defaults: { memory_mb: 256, cpu_millis: 500, pids_limit: 128 },
				timeouts: {
					build_timeout_seconds: 600,
					start_timeout_seconds: 120,
					command_timeout_seconds: 900
				}
			})
		).toBe(
			'Selama pilot, aplikasi berjalan dengan memori 256 MB dan CPU 0,5 vCPU, dan build dibatasi 10 menit.'
		);
	});
});

describe('getPortDisplay', () => {
	it('shows the serving port, and the next one when it differs', () => {
		expect(getPortDisplay({ serving_port: 3000, effective_port: 8080 })).toEqual({
			current: 3000,
			next: 8080
		});
	});

	it('has no next port when they agree', () => {
		expect(getPortDisplay({ serving_port: 8080, effective_port: 8080 })).toEqual({
			current: 8080,
			next: null
		});
	});

	it.each([undefined, null])('falls back to effective_port when serving_port is %s', (port) => {
		expect(getPortDisplay({ serving_port: port, effective_port: 8080 })).toEqual({
			current: 8080,
			next: null
		});
	});
});

describe('getFrameworkLabel', () => {
	it.each([
		['next', 'Next.js'],
		['laravel', 'Laravel'],
		['FastAPI', 'FastAPI']
	])('shows %s as %s', (framework, label) => {
		expect(getFrameworkLabel(framework)).toBe(label);
	});

	it('keeps the word from the API when it does not know the framework', () => {
		expect(getFrameworkLabel('phoenix')).toBe('phoenix');
	});
});

describe('a suspended project', () => {
	it('offers no Redeploy and no site, whatever the runtime says', () => {
		const state = deriveProjectHeaderState({
			status: 'suspended',
			runtime_status: 'running',
			active_deployment_id: 'dep-1'
		});
		expect(state.kind).toBe('suspended');
		expect(state.showRedeploy).toBe(false);
		expect(state.serving).toBe(false);
	});
});

describe('a sleeping project and its URL', () => {
	const sleeping = {
		status: 'active',
		runtime_status: 'sleeping',
		active_deployment_id: 'dep_1'
	} as const;

	it('is not serving, so it never claims Live', () => {
		expect(isProjectServing(sleeping)).toBe(false);
	});

	it('the list links running and sleeping projects, never suspended ones', () => {
		expect(isListedProjectUrlReachable({ runtime_status: 'sleeping', suspension: null })).toBe(
			true
		);
		expect(isListedProjectUrlReachable({ runtime_status: 'running', suspension: null })).toBe(true);
		expect(isListedProjectUrlReachable({ runtime_status: 'stopped', suspension: null })).toBe(
			false
		);
		expect(
			isListedProjectUrlReachable({
				runtime_status: 'sleeping',
				suspension: { reason: null, suspended_at: null }
			})
		).toBe(false);
	});
});

describe('getProjectWakeErrorMessage', () => {
	const conflict = (code: string, extra: Record<string, unknown> = {}) =>
		apiErrorFromResponse(409, { code, apiMessage: 'Pesan dari API.', details: extra });

	it('names the workspace limit with the counts the API sent', () => {
		expect(
			getProjectWakeErrorMessage(conflict(PROJECT_WAKE_LIMIT_EXCEEDED, { limit: 3, current: 3 }))
		).toBe(
			'Batas aplikasi aktif workspace sudah penuh, 3 dari 3. Coba lagi setelah ada proyek lain yang tidur atau dihapus.'
		);
	});

	it("falls back to the API's words when the counts are missing", () => {
		expect(getProjectWakeErrorMessage(conflict(PROJECT_WAKE_LIMIT_EXCEEDED))).toBe(
			'Pesan dari API.'
		);
	});

	it('says nothing for a project that is already awake, because the header catches up', () => {
		expect(
			getProjectWakeErrorMessage(conflict(PROJECT_NOT_SLEEPING, { runtime_status: 'running' }))
		).toBeNull();
	});

	it('says a suspended project cannot be woken, instead of the deploy wording', () => {
		expect(getProjectWakeErrorMessage(conflict(PROJECT_SUSPENDED))).toBe(
			PROJECT_WAKE_COPY.suspended
		);
	});

	it('keeps a safe fallback for anything else', () => {
		expect(getProjectWakeErrorMessage(new TypeError('boom'))).toBe(PROJECT_WAKE_COPY.failed);
		expect(getProjectWakeErrorMessage(new NetworkError())).toBe(
			'Sakala API tidak dapat dijangkau.'
		);
	});
});

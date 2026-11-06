import type { PilotLimits } from '$lib/api/resources/pilot-limits';
import { ApiError, NetworkError } from '$lib/api/errors';
import type { RuntimeStatus } from '$lib/api/resources/projects';
import { getDeploymentStatusLabel } from '$lib/features/deployments/status-config';
import { ACTIVE_DEPLOYMENT_STATUSES, type Deployment, type Project } from './type';

export type RuntimeStatusPresentation = {
	label: string;
	variant: 'neutral' | 'success' | 'error' | 'warning' | 'info' | 'muted' | 'running' | 'queued';
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
		label: 'Crash',
		variant: 'error'
	},
	deploying: {
		label: 'Men-deploy',
		variant: 'running'
	},
	not_deployed: {
		label: 'Belum deploy',
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
				description: 'Sesi kamu sudah berakhir. Silakan masuk kembali untuk melihat proyek.',
				action: 'login'
			};
		}

		if (error.isServerError) {
			return {
				title: 'Server sedang bermasalah',
				description: 'Terjadi masalah pada server saat mengambil data proyek. Silakan coba lagi.',
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
		title: 'Gagal memuat proyek',
		description: 'Terjadi kendala saat mengambil data proyek. Silakan coba lagi.',
		action: 'retry'
	};
}

/** `null` when the list has no failed deployment, for example because it sits past the first page. */
export function findLatestFailedDeployment<T extends Pick<Deployment, 'status' | 'sequence'>>(
	deployments: readonly T[]
): T | null {
	return deployments.reduce<T | null>((latest, deployment) => {
		if (deployment.status !== 'failed') return latest;
		return !latest || deployment.sequence > latest.sequence ? deployment : latest;
	}, null);
}

/**
 * The URL the API says the project answers on, because only the API knows the scheme and port of
 * this installation. `null` when it sent none, so the UI says so instead of linking to a guess.
 */
export function getProjectPublicUrl(
	project: { public_url?: string | null } | null | undefined
): string | null {
	const url = project?.public_url?.trim();
	// The API joins scheme and domain, so a project without a domain arrives as a bare `https://`.
	return url && /^https?:\/\/[^/:\s]/i.test(url) ? url : null;
}

/** The URL without its scheme, for showing. A port stays, because it is part of the address. */
export function getPublicUrlLabel(url: string): string {
	return url.replace(/^https?:\/\//i, '');
}

/** A failed or queued attempt leaves the previous deployment serving; the agent cuts over last. */
export function isProjectServing(
	project: Pick<Project, 'status' | 'runtime_status' | 'active_deployment_id'>
): boolean {
	if (project.status === 'suspended') return false;
	if (project.runtime_status === 'running') return true;
	return project.runtime_status === 'deploying' && Boolean(project.active_deployment_id);
}

export type ProjectHeaderKind =
	| 'suspended'
	| 'deploying'
	| 'not_deployed'
	| 'failed'
	| 'live'
	| 'live_failed_attempt'
	| 'crashed'
	| 'stopped'
	| 'unknown';

export type ProjectHeaderNotice = {
	tone: 'info' | 'warning' | 'error' | 'muted';
	message: string;
	link?: { label: string; deploymentId: string; toLogs: boolean };
};

export type ProjectHeaderState = {
	kind: ProjectHeaderKind;
	badge: RuntimeStatusPresentation;
	/** Offered at all: a suspended project has no Redeploy, and says why. */
	showRedeploy: boolean;
	/** A deployment is already running, and a second click would only hit the limit. */
	redeployBusy: boolean;
	/** The public URL answers right now, so it may be shown. */
	serving: boolean;
	/** The address is worth showing though the project is not reliably serving. */
	showUrl?: boolean;
	notice: ProjectHeaderNotice | null;
};

type HeaderDeployment = Pick<
	Deployment,
	'id' | 'status' | 'sequence' | 'queue_state' | 'cancel_requested_at'
>;

function describeRunningDeployment(deployment: HeaderDeployment | null): string {
	if (!deployment) return 'Deployment sedang berjalan.';

	const name = `Deployment #${deployment.sequence}`;
	if (deployment.cancel_requested_at) return `${name} sedang dibatalkan.`;
	if (deployment.queue_state === 'waiting_for_node') {
		return `${name} mengantre karena belum ada server Sakala yang siap. Deployment ini tetap mengantre sampai ada server yang siap.`;
	}
	if (deployment.status === 'queued') return `${name} mengantre.`;
	return `${name} sedang berjalan, tahap ${getDeploymentStatusLabel(deployment.status)}.`;
}

/**
 * One truthful reading of a project, from what the API reports. `status` only says draft, active,
 * or suspended, and stays draft until a deployment first succeeds, so apart from suspended it never
 * decides what the header claims. A queued attempt has not touched `runtime_status` yet, which is
 * why the newest deployment counts too.
 */
export function deriveProjectHeaderState(
	project: Pick<Project, 'status' | 'runtime_status' | 'active_deployment_id'>,
	recentDeployments: readonly HeaderDeployment[] = []
): ProjectHeaderState {
	const latest = recentDeployments.reduce<HeaderDeployment | null>(
		(newest, deployment) =>
			!newest || deployment.sequence > newest.sequence ? deployment : newest,
		null
	);
	const running = latest && ACTIVE_DEPLOYMENT_STATUSES.includes(latest.status) ? latest : null;
	const runtimeStatus = toRuntimeStatus(project.runtime_status);
	const serving = isProjectServing(project);

	const base = { showRedeploy: true, redeployBusy: false, serving: false, notice: null };

	if (project.status === 'suspended') {
		return {
			...base,
			kind: 'suspended',
			badge: { label: 'Ditangguhkan', variant: 'warning' },
			showRedeploy: false,
			notice: {
				tone: 'warning',
				message:
					'Proyek ini ditangguhkan oleh admin Sakala, jadi trafiknya diputus dan belum bisa di-deploy.'
			}
		};
	}

	if (running || runtimeStatus === 'deploying') {
		const description = describeRunningDeployment(running);
		return {
			...base,
			kind: 'deploying',
			badge: runtimeStatusPresentation.deploying,
			redeployBusy: true,
			serving,
			notice: {
				tone: 'info',
				message: serving ? `${description} Versi sebelumnya masih melayani.` : description,
				link: running
					? { label: 'Lihat progres', deploymentId: running.id, toLogs: false }
					: undefined
			}
		};
	}

	switch (runtimeStatus) {
		case 'not_deployed':
			return {
				...base,
				kind: 'not_deployed',
				badge: runtimeStatusPresentation.not_deployed,
				notice: {
					tone: 'muted',
					message: 'Belum ada deployment. Jalankan deploy pertamamu untuk mendapatkan URL publik.'
				}
			};

		case 'failed': {
			const failed = findLatestFailedDeployment(recentDeployments);
			return {
				...base,
				kind: 'failed',
				badge: runtimeStatusPresentation.failed,
				notice: {
					tone: 'error',
					message:
						'Deploy gagal, belum ada URL publik yang aktif. Cek log untuk lihat penyebabnya.',
					link: failed ? { label: 'Lihat log', deploymentId: failed.id, toLogs: true } : undefined
				}
			};
		}

		case 'crashed':
			return {
				...base,
				kind: 'crashed',
				badge: runtimeStatusPresentation.crashed,
				// A crash loop still answers between restarts, so the address stays useful.
				showUrl: Boolean(project.active_deployment_id),
				notice: {
					tone: 'error',
					message:
						'Aplikasi terus berhenti dan dimulai ulang, jadi URL-nya mungkin kadang bisa dibuka, kadang tidak. Cek log untuk lihat penyebabnya, perbaiki, lalu redeploy.',
					link: project.active_deployment_id
						? { label: 'Lihat log', deploymentId: project.active_deployment_id, toLogs: true }
						: undefined
				}
			};

		case 'stopped':
			return {
				...base,
				kind: 'stopped',
				badge: runtimeStatusPresentation.stopped,
				notice: {
					tone: 'muted',
					message:
						'Aplikasi sedang dihentikan dan tidak melayani. Redeploy untuk menyalakannya lagi.'
				}
			};

		case 'running':
			if (latest?.status === 'failed') {
				return {
					...base,
					kind: 'live_failed_attempt',
					badge: runtimeStatusPresentation.running,
					serving: true,
					notice: {
						tone: 'warning',
						message: `Deployment #${latest.sequence} gagal. Versi sebelumnya masih melayani.`,
						link: { label: 'Lihat log', deploymentId: latest.id, toLogs: true }
					}
				};
			}
			return { ...base, kind: 'live', badge: runtimeStatusPresentation.running, serving: true };

		default:
			return { ...base, kind: 'unknown', badge: { label: 'Lainnya', variant: 'neutral' } };
	}
}

/**
 * One name per deployment status, for the card, the header, and the timeline's last step. Short, in
 * Indonesian, and never a generic build error. `Live` is about a project, so a deployment never says it.
 */
export function getDeploymentBadge(status: string): RuntimeStatusPresentation {
	if (status === 'succeeded') return { label: 'Berhasil', variant: 'success' };
	if (status === 'failed') return { label: 'Gagal', variant: 'error' };
	if (status === 'cancelled') return { label: 'Dibatalkan', variant: 'muted' };
	if (status === 'queued') return { label: 'Mengantre', variant: 'queued' };
	if (ACTIVE_DEPLOYMENT_STATUSES.includes(status as Deployment['status'])) {
		return { label: 'Men-deploy', variant: 'running' };
	}
	return { label: status.replaceAll('_', ' '), variant: 'muted' };
}

export function getDeploymentCardNote(
	deployment: Pick<Deployment, 'status' | 'failure' | 'queue_state' | 'cancel_requested_at'>
): string | null {
	const { status, failure } = deployment;

	if (status === 'cancelled') return 'Dibatalkan sebelum selesai';
	if (status === 'failed') {
		return failure?.stage
			? `Gagal di tahap ${getDeploymentStatusLabel(failure.stage)}`
			: 'Gagal, lihat detail untuk penyebabnya';
	}
	if (deployment.cancel_requested_at) return 'Sedang dibatalkan';
	if (deployment.queue_state === 'waiting_for_node') return 'Menunggu server siap';
	if (ACTIVE_DEPLOYMENT_STATUSES.includes(status)) {
		return `Tahap: ${getDeploymentStatusLabel(status)}`;
	}
	return null;
}

/** The shape on a deployment status, for the small indicator in a history row. */
export function getDeploymentIndicatorStatus(
	status: string
): 'pending' | 'running' | 'success' | 'failed' | 'cancelled' {
	if (status === 'succeeded') return 'success';
	if (status === 'failed') return 'failed';
	if (status === 'cancelled') return 'cancelled';
	return 'running';
}

const SUSPENSION_TITLE = 'Proyek ditangguhkan';
const SUSPENSION_REASON = /Alasannya: (.+?)\s+Kalau menurutmu/s;

/**
 * The API does not put the reason on the project. It sends it once, in the owner's notification
 * (`SuspendProjectAction`), so that notification is the only place to read it from. The newest one
 * wins, and a message in another shape returns whole rather than being cut up.
 */
export function findSuspensionReason(
	notifications: readonly {
		title: string | null;
		message: string | null;
		project_id: string | null;
	}[],
	projectId: string
): string | null {
	const notice = notifications.find(
		(item) => item.project_id === projectId && item.title === SUSPENSION_TITLE
	);
	if (!notice?.message) return null;
	return notice.message.match(SUSPENSION_REASON)?.[1] ?? notice.message;
}

const FRAMEWORK_LABELS: Record<string, string> = {
	astro: 'Astro',
	django: 'Django',
	express: 'Express',
	fastapi: 'FastAPI',
	flask: 'Flask',
	gatsby: 'Gatsby',
	hono: 'Hono',
	laravel: 'Laravel',
	nest: 'NestJS',
	nestjs: 'NestJS',
	next: 'Next.js',
	nextjs: 'Next.js',
	nuxt: 'Nuxt',
	rails: 'Rails',
	react: 'React',
	remix: 'Remix',
	spring: 'Spring',
	svelte: 'Svelte',
	sveltekit: 'SvelteKit',
	vite: 'Vite',
	vue: 'Vue'
};

/** A framework the map does not know keeps the API's own word rather than a guess. */
export function getFrameworkLabel(framework: string): string {
	return FRAMEWORK_LABELS[framework.toLowerCase()] ?? framework;
}

type PilotQuotas = PilotLimits['quotas'];

/** What the pilot allows, shown before a create or a deploy runs into it. */
export function getProjectQuotaNotice(limits: Pick<PilotLimits, 'quotas'>): {
	reached: boolean;
	message: string;
} {
	const { current_projects_count: current, max_projects_per_user: max } = limits.quotas;
	if (current >= max) {
		return {
			reached: true,
			message: `Kuota proyek selama pilot sudah terpakai semua, ${current} dari ${max}. Hapus proyek yang tidak dipakai lewat tab Pengaturan di halaman proyeknya, supaya bisa membuat yang baru.`
		};
	}
	return {
		reached: false,
		message: `Kamu memakai ${current} dari ${max} proyek yang tersedia selama pilot.`
	};
}

export function isProjectQuotaReached(quotas: PilotQuotas | undefined): boolean {
	return quotas ? quotas.current_projects_count >= quotas.max_projects_per_user : false;
}

export function getActiveDeploymentLimitNotice(quotas: PilotQuotas): string | null {
	const { current_active_deployments_count: current, max_active_deployments_per_user: max } =
		quotas;
	if (current < max) return null;
	return `Kamu sudah punya ${current} deployment yang berjalan, dan batasnya ${max} selama pilot. Tunggu salah satunya selesai sebelum deploy lagi.`;
}

const decimal = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });

export function formatPilotRuntime(limits: Pick<PilotLimits, 'runtime_defaults' | 'timeouts'>) {
	const { memory_mb: memory, cpu_millis: cpu } = limits.runtime_defaults;
	const buildMinutes = decimal.format(limits.timeouts.build_timeout_seconds / 60);
	return `Selama pilot, aplikasi berjalan dengan memori ${memory} MB dan CPU ${decimal.format(cpu / 1000)} vCPU, dan build dibatasi ${buildMinutes} menit.`;
}

/**
 * The port traffic reaches now, and the one the next deployment will use if that differs. Before the
 * API sends `serving_port`, `effective_port` is all there is.
 */
export function getPortDisplay(
	project: Pick<Project, 'effective_port'> & { serving_port?: number | null }
): { current: number; next: number | null } {
	const serving = project.serving_port ?? null;
	if (serving === null) return { current: project.effective_port, next: null };
	return {
		current: serving,
		next: serving === project.effective_port ? null : project.effective_port
	};
}

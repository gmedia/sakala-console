import type { PilotLimits } from '$lib/api/resources/pilot-limits';
import {
	ACTIVE_CONTAINER_LIMIT_EXCEEDED,
	ApiError,
	getErrorMessage,
	NetworkError,
	PROJECT_NOT_SLEEPING,
	PROJECT_RELEASE_COMMAND_UNSUPPORTED,
	PROJECT_REPLICAS_UNSUPPORTED,
	PROJECT_SUSPENDED,
	PROJECT_WAKE_LIMIT_EXCEEDED
} from '$lib/api/errors';
import type { RuntimeStatus } from '$lib/api/resources/projects';
import { parseWakeLimitDetails } from '$lib/api/resources/project-wake';
import {
	parseContainerLimitDetails,
	parseReplicasUnsupportedDetails
} from '$lib/api/resources/project-deploy-refusals';
import { getDeploymentStatusLabel } from '$lib/features/deployments/status-config';
import { RELEASE_COMMAND_LABEL } from './build-help';
import { getReplicaHealth, MIN_REPLICAS, REPLICAS_COPY, type ReplicaHealth } from './replicas';
import { ACTIVE_DEPLOYMENT_STATUSES, type Deployment, type Project } from './type';
import { VARIABLE_BUILD_REASONS, type VariableBuildDecision } from './variable-build';

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
	},
	// Sleeping is the normal state of a quiet project, so it reads calm, not as a warning.
	sleeping: {
		label: 'Tidur',
		variant: 'muted'
	}
};

/** Beside `Live`: the deployment runs, but visitors still reach the previous version. */
export const deployingNewVersionPresentation: RuntimeStatusPresentation = {
	label: 'Men-deploy versi baru',
	variant: 'running'
};

/** A suspended project reads the same everywhere, whatever its runtime is still doing. */
export const suspendedStatusPresentation: RuntimeStatusPresentation = {
	label: 'Ditangguhkan',
	variant: 'warning'
};

/**
 * The badge for a project in the list. The list carries `suspension`, which the API sends exactly
 * when the project is suspended, instead of `status`. Without this a suspended project shows Live
 * until the agent stops it and Berhenti after, while its header says Ditangguhkan.
 */
export function getProjectListStatusPresentation(project: {
	runtime_status: string;
	suspension: unknown;
}): RuntimeStatusPresentation {
	if (project.suspension != null) return suspendedStatusPresentation;

	const status = toRuntimeStatus(project.runtime_status);
	return status ? runtimeStatusPresentation[status] : { label: 'Lainnya', variant: 'neutral' };
}

/** Every status the Console has a label for; anything newer shows as Lainnya. */
const knownRuntimeStatuses = Object.keys(runtimeStatusPresentation) as readonly RuntimeStatus[];

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

/**
 * Whether a card links its address. A sleeping project does not serve, but opening its URL shows a
 * page that wakes it, so the link stays. The list sends `suspension` instead of `status`.
 */
export function isListedProjectUrlReachable(project: {
	runtime_status: string;
	suspension: unknown;
}): boolean {
	if (project.suspension != null) return false;
	const status = toRuntimeStatus(project.runtime_status);
	return status === 'running' || status === 'sleeping';
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
	| 'sleeping'
	| 'unknown';

export type ProjectHeaderNotice = {
	/** `info` spins, because something is in progress; `sleeping` is calm on purpose. */
	tone: 'info' | 'warning' | 'error' | 'muted' | 'sleeping';
	message: string;
	link?: { label: string; deploymentId: string; toLogs: boolean };
};

export type ProjectHeaderState = {
	kind: ProjectHeaderKind;
	/** What visitors get now: `Live` while the previous version serves during a deploy. */
	badge: RuntimeStatusPresentation;
	/** Work beside that state, shown as a second badge: a new version deploying over a live one. */
	activity: RuntimeStatusPresentation | null;
	/** Offered at all: a suspended project has no Redeploy, and says why. */
	showRedeploy: boolean;
	/** A deployment is already running, and a second click would only hit the limit. */
	redeployBusy: boolean;
	/** The project sleeps, so Bangunkan is the main action. */
	showWake: boolean;
	/** The public URL answers right now, so it may be shown. */
	serving: boolean;
	/** The address is worth showing though the project is not reliably serving. */
	showUrl?: boolean;
	notice: ProjectHeaderNotice | null;
	/** Healthy replicas of the serving deployment, only while it serves more than one. */
	replicaHealth: ReplicaHealth | null;
};

type HeaderClaims = Omit<ProjectHeaderState, 'replicaHealth'>;

type HeaderProject = Pick<
	Project,
	'status' | 'runtime_status' | 'active_deployment_id' | 'serving_replicas' | 'replicas_ready'
>;

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

export type ProjectHeaderOptions = {
	/** The workspace's effective idle window, when known; `0` means its projects never sleep. */
	idleSleepMinutes?: number | null;
};

/** Neutral on purpose: sleeping is what a quiet project does, not something that went wrong. */
export function getSleepingNotice(idleSleepMinutes?: number | null): string {
	const why = idleSleepMinutes
		? `tidak ada pengunjung selama ${decimal.format(idleSleepMinutes)} menit`
		: 'lama tidak ada pengunjung';
	return `Proyek ini sedang tidur karena ${why}. Ini normal: proyek menyala lagi saat URL-nya dibuka.`;
}

export const PROJECT_WAKE_COPY = {
	action: 'Bangunkan',
	busy: 'Membangunkan...',
	requested: 'Proyek sedang dibangunkan. Statusnya berubah jadi Live begitu aplikasinya siap.',
	failed: 'Proyek belum berhasil dibangunkan. Silakan coba lagi.',
	suspended: 'Proyek ini ditangguhkan admin Sakala, jadi belum bisa dibangunkan.'
} as const;

/**
 * What to say when a wake is refused. `null` for a project that is no longer asleep: the refreshed
 * header already tells the truth, so there is nothing to apologise for.
 */
export function getProjectWakeErrorMessage(error: unknown): string | null {
	if (error instanceof ApiError) {
		if (error.code === PROJECT_NOT_SLEEPING) return null;
		if (error.code === PROJECT_SUSPENDED) return PROJECT_WAKE_COPY.suspended;
		if (error.code === PROJECT_WAKE_LIMIT_EXCEEDED) {
			const usage = parseWakeLimitDetails(error.details);
			if (usage && (usage.requested ?? MIN_REPLICAS) > MIN_REPLICAS) {
				return `Proyek ini berjalan dengan ${usage.requested} replika, dan batas aplikasi aktif workspace tidak cukup: ${usage.current} dari ${usage.limit} sudah terpakai. Coba lagi setelah ada proyek lain yang tidur atau dihapus.`;
			}
			if (usage) {
				return `Batas aplikasi aktif workspace sudah penuh, ${usage.current} dari ${usage.limit}. Coba lagi setelah ada proyek lain yang tidur atau dihapus.`;
			}
		}
	}
	return getErrorMessage(error, PROJECT_WAKE_COPY.failed);
}

/** Emptying the field deploys without the command, so the message says the command is skipped. */
export const RELEASE_COMMAND_UNSUPPORTED_MESSAGE = `Proyek ini punya release command, tetapi server yang menjalankannya belum bisa menjalankan release command. Untuk deploy sekarang tanpa perintah itu, kosongkan ${RELEASE_COMMAND_LABEL} di tab Pengaturan. Atau coba lagi setelah servernya diperbarui.`;

/**
 * What to say when a deployment is refused. The replica and release command refusals point at the
 * setting that causes them; anything else, and a refusal without its counts, keeps the API's own
 * words.
 */
export function getDeployErrorMessage(error: unknown, fallback: string): string {
	if (error instanceof ApiError) {
		if (error.code === PROJECT_RELEASE_COMMAND_UNSUPPORTED) {
			return RELEASE_COMMAND_UNSUPPORTED_MESSAGE;
		}
		if (error.code === PROJECT_REPLICAS_UNSUPPORTED) {
			const setting = parseReplicasUnsupportedDetails(error.details);
			if (setting?.node_maximum != null) {
				return `Proyek ini diatur berjalan dengan ${setting.replicas} replika, tetapi server yang menjalankannya paling banyak menjalankan ${setting.node_maximum} replika per proyek. Kurangi ${REPLICAS_COPY.label.toLowerCase()} di tab Pengaturan menjadi ${setting.node_maximum} atau kurang, lalu deploy lagi.`;
			}
			if (setting) {
				return `Proyek ini diatur berjalan dengan ${setting.replicas} replika, tetapi server yang menjalankannya belum mendukung replika. Ubah ${REPLICAS_COPY.label} menjadi ${MIN_REPLICAS} di tab Pengaturan untuk deploy sekarang, atau coba lagi setelah servernya diperbarui.`;
			}
		}
		if (error.code === ACTIVE_CONTAINER_LIMIT_EXCEEDED) {
			const usage = parseContainerLimitDetails(error.details);
			if (usage && (usage.requested ?? MIN_REPLICAS) > MIN_REPLICAS) {
				return `Deployment ini menjalankan ${usage.requested} replika, sementara workspace sudah menjalankan ${usage.current} dari batas ${usage.limit} container. Kurangi ${REPLICAS_COPY.label.toLowerCase()} di tab Pengaturan, hapus proyek yang tidak dipakai, atau tunggu sampai ada proyek yang tidur.`;
			}
		}
	}
	return getErrorMessage(error, fallback);
}

/** The notice for settings the running deployment does not use yet (`redeploy_required`). */
/**
 * The Redeploy control. Redeploy lets the API reuse the live image when it can; the menu beside it
 * holds the one other way, a full build, and says how the two differ.
 */
export const REDEPLOY_COPY = {
	action: 'Redeploy',
	busy: 'Menjalankan...',
	firstDeploy: 'Deploy sekarang',
	otherDeploymentRunning: 'Sedang men-deploy',
	/** The menu button's name. It leaves out "redeploy", so the Redeploy button keeps its own name. */
	menuLabel: 'Pilihan cara build',
	reuse: {
		label: 'Redeploy',
		description:
			'Memakai ulang image yang sedang dipakai kalau commit, pengaturan build, dan variabel yang dibaca saat build tidak berubah, jadi jauh lebih cepat.'
	},
	forceBuild: {
		label: 'Build ulang dari awal',
		description:
			'Build dari commit terbaru tanpa memakai image lama. Pakai kalau hasil build sebelumnya bermasalah, atau build membaca variabel lain yang baru kamu ubah.'
	}
} as const;

export const REDEPLOY_REQUIRED_COPY = {
	variables:
		'Perubahan variabel belum dipakai aplikasi yang sedang berjalan. Redeploy supaya perubahannya berlaku.',
	settings:
		'Proyek ini perlu redeploy: ada perubahan yang belum dipakai aplikasi yang sedang berjalan. Redeploy supaya perubahannya berlaku.',
	action: 'Redeploy sekarang',
	busy: 'Menjalankan...'
} as const;

/**
 * What the next redeploy does after a variable change, said next to the save action before the
 * user saves (`decideVariableBuild`). Each build reason is a whole sentence, so no sentence is glued
 * together from parts.
 */
export const VARIABLE_BUILD_COPY = {
	reuse: 'Cukup restart dengan image yang sama (tanpa build).',
	staticSite:
		'Perubahan ini butuh build ulang karena situs ini disajikan sebagai file statis, jadi nilai variabel ikut tersimpan di hasil build.',
	prerenderFramework: (framework: string | null) =>
		`Perubahan ini butuh build ulang karena ${framework ?? 'framework aplikasi ini'} bisa membuat halaman saat build, jadi nilai variabel ikut tersimpan di hasil build.`,
	buildTimePrefix: (prefix: string) =>
		`Perubahan ini butuh build ulang karena variabel berawalan ${prefix} dibaca saat build.`,
	buildTimeKey: (key: string) => `Perubahan ini butuh build ulang karena ${key} dibaca saat build.`,
	unknownStack:
		'Perubahan ini butuh build ulang karena Sakala belum bisa memastikan cara aplikasi ini membaca variabel.',
	/** Under the variables from the attached database, which never build (rule 4 of the API). */
	database:
		'Perubahan variabel ini, misalnya setelah Ganti password, cukup restart dengan image yang sama (tanpa build).'
} as const;

/** The sentence for a decision. `framework` is the project's `stack.framework`, when it is known. */
export function getVariableBuildHint(
	decision: VariableBuildDecision,
	framework: string | null | undefined
): string {
	if (!decision.needsBuild) return VARIABLE_BUILD_COPY.reuse;
	switch (decision.reason) {
		case VARIABLE_BUILD_REASONS.staticSite:
			return VARIABLE_BUILD_COPY.staticSite;
		case VARIABLE_BUILD_REASONS.prerenderFramework:
			return VARIABLE_BUILD_COPY.prerenderFramework(
				framework ? getFrameworkLabel(framework) : null
			);
		case VARIABLE_BUILD_REASONS.buildTimePrefix:
			return decision.prefix === null
				? VARIABLE_BUILD_COPY.buildTimeKey(decision.key)
				: VARIABLE_BUILD_COPY.buildTimePrefix(decision.prefix);
		case VARIABLE_BUILD_REASONS.unknownStack:
			return VARIABLE_BUILD_COPY.unknownStack;
	}
}

/**
 * One truthful reading of a project, from what the API reports. `status` only says draft, active,
 * or suspended, and stays draft until a deployment first succeeds, so apart from suspended it never
 * decides what the header claims. A queued attempt has not touched `runtime_status` yet, which is
 * why the newest deployment counts too.
 */
export function deriveProjectHeaderState(
	project: HeaderProject,
	recentDeployments: readonly HeaderDeployment[] = [],
	options: ProjectHeaderOptions = {}
): ProjectHeaderState {
	const claims = deriveHeaderClaims(project, recentDeployments, options);
	// Replica counts describe the deployment that serves, so they only show while it does.
	return { ...claims, replicaHealth: claims.serving ? getReplicaHealth(project) : null };
}

function deriveHeaderClaims(
	project: HeaderProject,
	recentDeployments: readonly HeaderDeployment[],
	options: ProjectHeaderOptions
): HeaderClaims {
	const latest = recentDeployments.reduce<HeaderDeployment | null>(
		(newest, deployment) =>
			!newest || deployment.sequence > newest.sequence ? deployment : newest,
		null
	);
	const running = latest && ACTIVE_DEPLOYMENT_STATUSES.includes(latest.status) ? latest : null;
	const runtimeStatus = toRuntimeStatus(project.runtime_status);
	const serving = isProjectServing(project);

	const base = {
		activity: null,
		showRedeploy: true,
		redeployBusy: false,
		showWake: false,
		serving: false,
		notice: null
	};

	if (project.status === 'suspended') {
		return {
			...base,
			kind: 'suspended',
			badge: suspendedStatusPresentation,
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
		// The agent cuts over last, so a live project stays Live until the new version takes over.
		return {
			...base,
			kind: 'deploying',
			badge: serving ? runtimeStatusPresentation.running : runtimeStatusPresentation.deploying,
			activity: serving ? deployingNewVersionPresentation : null,
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

		case 'sleeping':
			return {
				...base,
				kind: 'sleeping',
				badge: runtimeStatusPresentation.sleeping,
				showWake: true,
				showUrl: true,
				notice: { tone: 'sleeping', message: getSleepingNotice(options.idleSleepMinutes) }
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
/** `workspaceName` is set for a team workspace, whose quota all its members share. */
export function getProjectQuotaNotice(
	limits: Pick<PilotLimits, 'quotas'>,
	workspaceName?: string
): {
	reached: boolean;
	message: string;
} {
	const { current_projects_count: current, max_projects_per_user: max } = limits.quotas;
	if (workspaceName) {
		return current >= max
			? {
					reached: true,
					message: `Kuota proyek workspace ${workspaceName} sudah terpakai semua, ${current} dari ${max}. Hapus proyek yang tidak dipakai di workspace ini, atau minta admin Sakala memasang profil batas yang lebih besar.`
				}
			: {
					reached: false,
					message: `Workspace ${workspaceName} memakai ${current} dari ${max} proyek, dibagi untuk semua anggotanya.`
				};
	}
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

export function getActiveDeploymentLimitNotice(
	quotas: PilotQuotas,
	workspaceName?: string
): string | null {
	const { current_active_deployments_count: current, max_active_deployments_per_user: max } =
		quotas;
	if (current < max) return null;
	if (workspaceName) {
		return `Workspace ${workspaceName} sudah punya ${current} deployment yang berjalan, dan batasnya ${max}. Tunggu salah satunya selesai sebelum deploy lagi.`;
	}
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

import { createQuery, type QueryClient } from '@tanstack/svelte-query';
import { createCoalescedTask } from '$lib/features/realtime/coalesced-task';
import { queryKeys } from '$lib/api/query-keys';
import { getDomainPreview, getListProjects } from '$lib/api/resources/projects';
import { getPilotLimits } from '$lib/api/resources/pilot-limits';
import type {
	Project as ListedProject,
	ProjectResponse,
	ProjectsQueryParams
} from '$lib/api/resources/projects';
import { resolveRefetchInterval, rateLimitWait } from '$lib/features/deployments/queries';
import { realtimeState } from '$lib/realtime/connection-state.svelte';
import { getProject, getDeployments, getEnvironmentVariables } from './api';
import {
	ACTIVE_DEPLOYMENT_STATUSES,
	type Deployment,
	type GetDeploymentsParams,
	type PaginatedDeployments,
	type Project
} from './type';

export const projectKeys = {
	all: ['projects'] as const,
	detail: (id: string) => [...projectKeys.all, id] as const,
	deployments: (id: string, params?: GetDeploymentsParams) =>
		params
			? ([...projectKeys.detail(id), 'deployments', params] as const)
			: ([...projectKeys.detail(id), 'deployments'] as const),
	environmentVariables: (id: string) => [...projectKeys.detail(id), 'environmentVariables'] as const
};

export function createEnvironmentVariablesQuery(projectId: () => string) {
	return createQuery(() => ({
		queryKey: projectKeys.environmentVariables(projectId()),
		queryFn: () => getEnvironmentVariables(projectId()),
		enabled: !!projectId()
	}));
}

/*
 * `throttle:api` allows 60 requests a minute per user, shared with everything else on the page.
 * The project header can afford to lag a little, so it polls well below the deployment page's rate.
 */
export const HEADER_POLL_RUNNING_MS = 10_000;
export const HEADER_POLL_RUNNING_REALTIME_MS = 60_000;
export const HEADER_POLL_IDLE_MS = 60_000;

/** The newest deployments the project header reads its state from. The API caps `per_page` at 6. */
export const RECENT_DEPLOYMENTS_PARAMS = { page: 1, per_page: 6, filter: 'all' } as const;

export function isRunningDeployment(deployment: Pick<Deployment, 'status'>): boolean {
	return ACTIVE_DEPLOYMENT_STATUSES.includes(deployment.status);
}

/** Idle polling catches a deployment started elsewhere, such as a webhook, which sends no event. */
export function resolveHeaderPollInterval(hasRunningDeployment: boolean, error?: unknown): number {
	const wait = rateLimitWait(error);
	if (wait !== undefined) return wait;
	if (!hasRunningDeployment) return HEADER_POLL_IDLE_MS;
	return realtimeState.status === 'connected'
		? HEADER_POLL_RUNNING_REALTIME_MS
		: HEADER_POLL_RUNNING_MS;
}

/** Without realtime nothing announces a crash, so the header re-reads the project now and then. */
export function resolveProjectPollInterval(error?: unknown): number | false {
	const wait = rateLimitWait(error);
	if (wait !== undefined) return wait;
	return realtimeState.status === 'connected' ? false : HEADER_POLL_IDLE_MS;
}

/*
 * A list read is one request for six cards. Without the socket it polls, gently while something
 * deploys. With the socket up, `useProjectListLive` hears every step of a deployment on the page and
 * `users.{id}` announces how one ended, so polling only catches a start nobody announces, such as a
 * webhook, and a broadcast that was lost.
 */
export const LIST_POLL_RUNNING_MS = 15_000;
export const LIST_POLL_IDLE_MS = 60_000;
export const LIST_POLL_REALTIME_MS = 5 * 60_000;

export function resolveProjectListPollInterval(hasActivity: boolean, error?: unknown): number {
	const wait = rateLimitWait(error);
	if (wait !== undefined) return wait;
	if (realtimeState.status === 'connected') return LIST_POLL_REALTIME_MS;
	return hasActivity ? LIST_POLL_RUNNING_MS : LIST_POLL_IDLE_MS;
}

/** The list reads its state from `runtime_status`, and from the newest attempt before that moves. */
export function hasProjectInProgress(
	projects: readonly Pick<ListedProject, 'runtime_status' | 'latest_deployment'>[]
): boolean {
	return projects.some(
		(project) =>
			project.runtime_status === 'deploying' ||
			(project.latest_deployment !== null &&
				ACTIVE_DEPLOYMENT_STATUSES.includes(
					project.latest_deployment.status as Deployment['status']
				))
	);
}

const projectRefreshes = new Map<string, ReturnType<typeof createCoalescedTask>>();

/**
 * Re-reads what the header shows once a deployment has moved on. The header and the deployment page
 * both ask for this at the same moment, so they share one read.
 */
export function requestProjectRefresh(client: QueryClient, projectId: string): void {
	let task = projectRefreshes.get(projectId);
	if (!task) {
		task = createCoalescedTask(() => {
			void client.invalidateQueries({ queryKey: projectKeys.detail(projectId), exact: true });
			void client.invalidateQueries({ queryKey: projectKeys.deployments(projectId) });
			void client.invalidateQueries({ queryKey: queryKeys.pilotLimits });
		});
		projectRefreshes.set(projectId, task);
	}
	task.request();
}

export function createProjectQuery(projectId: () => string, options: { poll?: boolean } = {}) {
	return createQuery(() => ({
		queryKey: projectKeys.detail(projectId()),
		queryFn: () => getProject(projectId()),
		enabled: !!projectId(),
		refetchInterval: options.poll
			? (query: { state: { error: unknown } }) => resolveProjectPollInterval(query.state.error)
			: undefined
	}));
}

/** Inspection runs on a node, so the wizard asks until the status settles. */
export const INSPECTION_POLL_MS = 5_000;

export function resolveInspectionPollInterval(
	previewStatus: string | null | undefined,
	error?: unknown
): number | false {
	const wait = rateLimitWait(error);
	if (wait !== undefined) return wait;
	return previewStatus === 'pending' ? INSPECTION_POLL_MS : false;
}

export function createProjectInspectionQuery(projectId: () => string) {
	return createQuery(() => ({
		queryKey: projectKeys.detail(projectId()),
		queryFn: () => getProject(projectId()),
		enabled: !!projectId(),
		retry: false,
		refetchInterval: (query: { state: { data: Project | undefined; error: unknown } }) =>
			resolveInspectionPollInterval(query.state.data?.preview_status, query.state.error)
	}));
}

export function createDomainPreviewQuery(name: () => string) {
	return createQuery(() => {
		const current = name().trim();
		return {
			queryKey: queryKeys.domainPreview(current),
			queryFn: () => getDomainPreview(current),
			enabled: current !== '',
			retry: false
		};
	});
}

export function createPilotLimitsQuery() {
	return createQuery(() => ({
		queryKey: queryKeys.pilotLimits,
		queryFn: () => getPilotLimits(),
		retry: false
	}));
}

export function createRecentDeploymentsQuery(projectId: () => string) {
	return createQuery(() => {
		const id = projectId();
		return {
			queryKey: projectKeys.deployments(id, RECENT_DEPLOYMENTS_PARAMS),
			queryFn: () => getDeployments(id, RECENT_DEPLOYMENTS_PARAMS),
			enabled: !!id,
			refetchInterval: (query: { state: { data: unknown; error: unknown } }) => {
				const response = query.state.data as PaginatedDeployments | undefined;
				return resolveHeaderPollInterval(
					response?.data.some(isRunningDeployment) ?? false,
					query.state.error
				);
			}
		};
	});
}

export function createDeploymentsQuery(
	projectId: () => string,
	params?: () => GetDeploymentsParams | undefined
) {
	return createQuery(() => {
		const id = projectId();
		const p = params ? params() : undefined;
		return {
			queryKey: projectKeys.deployments(id, p),
			queryFn: () => getDeployments(id, p),
			enabled: !!id,
			refetchInterval: (query: { state: { data: unknown; error: unknown } }) => {
				const response = query.state.data as PaginatedDeployments | undefined;
				const data = response?.data;
				if (!data || !Array.isArray(data)) return false;

				return data.some(isRunningDeployment)
					? resolveRefetchInterval(false, query.state.error)
					: false;
			}
		};
	});
}

export function createListProjectsQuery(
	params: () => ProjectsQueryParams,
	options: () => { enabled?: boolean; poll?: boolean } = () => ({})
) {
	return createQuery(() => {
		const queryParams = params();
		const { enabled = true, poll = false } = options();

		return {
			queryKey: queryKeys.projects.list(queryParams),
			queryFn: () => getListProjects(queryParams),
			retry: false,
			enabled,
			refetchInterval: poll
				? (query) =>
						resolveProjectListPollInterval(
							hasProjectInProgress(query.state.data?.data ?? []),
							query.state.error
						)
				: undefined,
			select: (response: ProjectResponse) => ({
				projects: response.data,
				meta: response.meta
			}),
			placeholderData: (prev) => prev
		};
	});
}

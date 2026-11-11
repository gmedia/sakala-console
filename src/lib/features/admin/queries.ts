import { createInfiniteQuery, createQuery, keepPreviousData } from '@tanstack/svelte-query';
import { ApiError } from '$lib/api/errors';
import { queryKeys } from '$lib/api/query-keys';
import type { QueryParams } from '$lib/api/resources/admin/common';
import { getAdminOverview } from '$lib/api/resources/admin/overview';
import {
	getAdminUser,
	getAdminWorkspace,
	listAdminUsers,
	listAdminWorkspaces,
	listLimitProfiles
} from '$lib/api/resources/admin/accounts';
import { getAdminProject, listAdminProjects } from '$lib/api/resources/admin/projects';
import {
	getAdminDeployment,
	getAdminDeploymentEvents,
	getAdminDeploymentLogs,
	getFailureSummary,
	listFailedDeployments
} from '$lib/api/resources/admin/deployments';
import {
	getAdminAgent,
	getAgentCommand,
	listAdminAgents,
	listAgentCommands
} from '$lib/api/resources/admin/agents';
import { listAdminFeedback, listAuditEvents } from '$lib/api/resources/admin/audit';
import type { DeploymentEvent } from '$lib/api/resources/deployment';

/** The API caches the overview for 60 seconds; the page reads it again every five minutes. */
export const OVERVIEW_REFRESH_MS = 5 * 60_000;

/**
 * 403 and 404 are answers, not hiccups: retrying them only keeps the skeleton up longer.
 * Everything else gets the console's one retry.
 */
function retryAdmin(failureCount: number, error: unknown): boolean {
	if (error instanceof ApiError && error.status < 500 && error.status !== 408) return false;
	return failureCount < 1;
}

/** A list keeps showing the previous page while the next one loads, so the table does not jump. */
function listQuery<T>(key: readonly unknown[], fn: () => Promise<T>) {
	return {
		queryKey: key,
		queryFn: fn,
		placeholderData: keepPreviousData,
		retry: retryAdmin
	};
}

export function createAdminOverviewQuery(params: () => QueryParams) {
	return createQuery(() => ({
		queryKey: queryKeys.admin.overview(params()),
		queryFn: () => getAdminOverview(params()),
		placeholderData: keepPreviousData,
		refetchInterval: OVERVIEW_REFRESH_MS,
		retry: retryAdmin
	}));
}

/** A count from `meta.total` of a one-row page, for summary cards across the whole table. */
export function createAdminCountQuery(kind: 'agents' | 'feedback', params: () => QueryParams) {
	return createQuery(() => {
		const query = { ...params(), per_page: 1 };
		return {
			queryKey: kind === 'agents' ? queryKeys.admin.agents(query) : queryKeys.admin.feedback(query),
			queryFn: async () =>
				(kind === 'agents' ? await listAdminAgents(query) : await listAdminFeedback(query)).meta
					.total,
			retry: retryAdmin
		};
	});
}

export function createAdminUsersQuery(params: () => QueryParams) {
	return createQuery(() =>
		listQuery(queryKeys.admin.users(params()), () => listAdminUsers(params()))
	);
}

export function createAdminUserQuery(id: () => string) {
	return createQuery(() => ({
		queryKey: queryKeys.admin.user(id()),
		queryFn: () => getAdminUser(id()),
		retry: retryAdmin
	}));
}

export function createAdminWorkspacesQuery(params: () => QueryParams) {
	return createQuery(() =>
		listQuery(queryKeys.admin.workspaces(params()), () => listAdminWorkspaces(params()))
	);
}

export function createAdminWorkspaceQuery(id: () => string) {
	return createQuery(() => ({
		queryKey: queryKeys.admin.workspace(id()),
		queryFn: () => getAdminWorkspace(id()),
		retry: retryAdmin
	}));
}

export function createLimitProfilesQuery(params: () => QueryParams) {
	return createQuery(() =>
		listQuery(queryKeys.admin.limitProfiles(params()), () => listLimitProfiles(params()))
	);
}

/** Every profile for a picker. A hundred is the API's page limit and far above what exists. */
export function createLimitProfileOptionsQuery(enabled: () => boolean = () => true) {
	return createQuery(() => ({
		queryKey: queryKeys.admin.limitProfiles({ per_page: 100 }),
		queryFn: () => listLimitProfiles({ per_page: 100 }),
		enabled: enabled(),
		retry: retryAdmin
	}));
}

export function createAdminProjectsQuery(params: () => QueryParams) {
	return createQuery(() =>
		listQuery(queryKeys.admin.projects(params()), () => listAdminProjects(params()))
	);
}

export function createAdminProjectQuery(id: () => string) {
	return createQuery(() => ({
		queryKey: queryKeys.admin.project(id()),
		queryFn: () => getAdminProject(id()),
		retry: retryAdmin
	}));
}

export function createFailedDeploymentsQuery(params: () => QueryParams) {
	return createQuery(() =>
		listQuery(queryKeys.admin.failures(params()), () => listFailedDeployments(params()))
	);
}

export function createFailureSummaryQuery(params: () => QueryParams) {
	return createQuery(() => ({
		queryKey: queryKeys.admin.failureSummary(params()),
		queryFn: () => getFailureSummary(params()),
		placeholderData: keepPreviousData,
		refetchInterval: OVERVIEW_REFRESH_MS,
		retry: retryAdmin
	}));
}

export function createAdminDeploymentQuery(id: () => string) {
	return createQuery(() => ({
		queryKey: queryKeys.admin.deployment(id()),
		queryFn: () => getAdminDeployment(id()),
		retry: retryAdmin
	}));
}

/** A finished deployment's timeline is short; this reads all of it, at most 50 pages of ten. */
export function createAdminDeploymentEventsQuery(id: () => string) {
	return createQuery(() => ({
		queryKey: queryKeys.admin.deploymentEvents(id()),
		queryFn: async () => {
			const events: DeploymentEvent[] = [];
			let cursor: string | undefined;
			for (let page = 0; page < 50; page++) {
				const response = await getAdminDeploymentEvents(id(), cursor);
				events.push(...response.data);
				if (!response.meta.next_cursor) break;
				cursor = response.meta.next_cursor;
			}
			return events;
		},
		retry: retryAdmin
	}));
}

/** Newest page first; older pages on request. */
export function createAdminDeploymentLogsQuery(id: () => string) {
	return createInfiniteQuery(() => ({
		queryKey: queryKeys.admin.deploymentLogs(id()),
		queryFn: ({ pageParam }: { pageParam: string | null }) =>
			getAdminDeploymentLogs(id(), pageParam ?? undefined),
		initialPageParam: null as string | null,
		getNextPageParam: (last) => last.meta.next_cursor,
		retry: retryAdmin
	}));
}

export function createAdminAgentsQuery(params: () => QueryParams) {
	return createQuery(() =>
		listQuery(queryKeys.admin.agents(params()), () => listAdminAgents(params()))
	);
}

export function createAdminAgentQuery(id: () => string) {
	return createQuery(() => ({
		queryKey: queryKeys.admin.agent(id()),
		queryFn: () => getAdminAgent(id()),
		retry: retryAdmin
	}));
}

export function createAgentCommandsQuery(id: () => string, params: () => QueryParams) {
	return createQuery(() =>
		listQuery(queryKeys.admin.agentCommands(id(), params()), () =>
			listAgentCommands(id(), params())
		)
	);
}

export function createAgentCommandQuery(agentId: () => string, commandId: () => string | null) {
	return createQuery(() => ({
		queryKey: queryKeys.admin.agentCommand(agentId(), commandId() ?? ''),
		queryFn: () => getAgentCommand(agentId(), commandId()!),
		enabled: commandId() !== null,
		retry: retryAdmin
	}));
}

export function createAdminFeedbackQuery(params: () => QueryParams) {
	return createQuery(() =>
		listQuery(queryKeys.admin.feedback(params()), () => listAdminFeedback(params()))
	);
}

export function createAuditEventsQuery(params: () => QueryParams) {
	return createQuery(() =>
		listQuery(queryKeys.admin.audit(params()), () => listAuditEvents(params()))
	);
}

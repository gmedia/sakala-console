import { createQuery } from '@tanstack/svelte-query';
import { queryKeys } from '$lib/api/query-keys';
import { getListProjects } from '$lib/api/resources/projects';
import type { ProjectsQueryParams } from '$lib/api/resources/projects';
import { getProject, getDeployments, getEnvironmentVariables } from './api';
import {
	ACTIVE_DEPLOYMENT_STATUSES,
	type Deployment,
	type GetDeploymentsParams,
	type PaginatedDeployments
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

export function createProjectQuery(projectId: () => string) {
	return createQuery(() => ({
		queryKey: projectKeys.detail(projectId()),
		queryFn: () => getProject(projectId()),
		enabled: !!projectId()
	}));
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
			refetchInterval: (query: { state: { data: unknown } }) => {
				const response = query.state.data as PaginatedDeployments | undefined;
				const data = response?.data;
				if (!data || !Array.isArray(data)) return false;

				const isRunning = data.some(
					(d: Deployment) =>
						ACTIVE_DEPLOYMENT_STATUSES.includes(d.status) ||
						(d.status as string) === 'building' ||
						(d.status as string) === 'running' ||
						(d.status as string) === 'queued'
				);

				return isRunning ? 3000 : false;
			}
		};
	});
}

export function createListProjectsQuery(params: () => ProjectsQueryParams) {
	return createQuery(() => {
		const queryParams = params();

		return {
			queryKey: queryKeys.projects.list(queryParams),
			queryFn: () => getListProjects(queryParams),
			retry: false,
			select: (response) => ({
				projects: response.data,
				meta: response.meta
			}),
			placeholderData: (prev) => prev
		};
	});
}

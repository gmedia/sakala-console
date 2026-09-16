import { createQuery } from '@tanstack/svelte-query';
import { getProject, getDeployments, getEnvironmentVariables } from './api';
import { ACTIVE_DEPLOYMENT_STATUSES, type Deployment } from './type';

export const projectKeys = {
	all: ['projects'] as const,
	detail: (id: string) => [...projectKeys.all, id] as const,
	deployments: (id: string) => [...projectKeys.detail(id), 'deployments'] as const,
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

export function createDeploymentsQuery(projectId: () => string) {
	return createQuery(() => ({
		queryKey: projectKeys.deployments(projectId()),
		queryFn: () => getDeployments(projectId()),
		enabled: !!projectId(),
		refetchInterval: (query: { state: { data: unknown } }) => {
			const data = query.state.data as Deployment[];
			if (!data) return false;

			const isRunning = data.some(
				(d: Deployment) =>
					ACTIVE_DEPLOYMENT_STATUSES.includes(d.status) ||
					(d.status as string) === 'building' ||
					(d.status as string) === 'running' ||
					(d.status as string) === 'queued'
			);

			return isRunning ? 3000 : false;
		}
	}));
}

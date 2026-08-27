import { createQuery } from '@tanstack/svelte-query';
import { getProject, getDeployments } from './api';
import type { Deployment } from './type';

export const projectKeys = {
	all: ['projects'] as const,
	detail: (id: string) => [...projectKeys.all, id] as const,
	deployments: (id: string) => [...projectKeys.detail(id), 'deployments'] as const
};

export function createProjectQuery(id: string) {
	return createQuery(() => ({
		queryKey: projectKeys.detail(id),
		queryFn: () => getProject(id),
		enabled: !!id
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
					d.status === 'building' || d.status === 'running' || d.status === 'queued'
			);

			return isRunning ? 3000 : false;
		}
	}));
}

import type { ProjectsQueryParams } from './resources/projects';

export const queryKeys = {
	system: {
		status: ['system', 'status'] as const
	},
	auth: {
		currentUser: ['auth', 'currentUser'] as const
	},
	projects: {
		all: ['projects'] as const,
		list: (params: ProjectsQueryParams) => [...queryKeys.projects.all, 'list', params] as const,
		detail: (projectId: string) => ['projects', 'detail', projectId] as const
	},
	deployments: {
		all: ['deployments'] as const,
		detail: (projectId: string, deploymentId: string) =>
			[...queryKeys.deployments.all, 'detail', projectId, deploymentId] as const,
		events: (projectId: string, deploymentId: string) =>
			[...queryKeys.deployments.all, 'events', projectId, deploymentId] as const,
		logs: (deploymentId: string) => ['deployments', 'logs', deploymentId] as const
	},
	notifications: {
		unreadCount: ['notifications', 'unread-count'] as const
	},
	github: {
		all: ['github'] as const,
		installations: () => ['github', 'installations'] as const,
		repositories: (installationId: string) => ['github', 'repositories', installationId] as const
	}
};

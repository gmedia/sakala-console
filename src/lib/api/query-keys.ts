import type { GetInstallationRepositoriesParams } from './resources/github';
import type { NotificationListParams } from './resources/notifications';
import type { ProjectsQueryParams } from './resources/projects';

export const queryKeys = {
	auth: {
		currentUser: ['auth', 'currentUser'] as const,
		options: ['auth', 'options'] as const
	},
	projects: {
		all: ['projects'] as const,
		lists: ['projects', 'list'] as const,
		list: (params: ProjectsQueryParams) => [...queryKeys.projects.lists, params] as const,
		detail: (projectId: string) => ['projects', 'detail', projectId] as const
	},
	deployments: {
		all: ['deployments'] as const,
		detail: (projectId: string, deploymentId: string) =>
			[...queryKeys.deployments.all, 'detail', projectId, deploymentId] as const,
		events: (projectId: string, deploymentId: string) =>
			[...queryKeys.deployments.all, 'events', projectId, deploymentId] as const,
		logs: (deploymentId: string) => ['deployments', 'logs', deploymentId] as const,
		logsTail: (deploymentId: string) => ['deployments', 'logs-tail', deploymentId] as const
	},
	notifications: {
		all: ['notifications'] as const,
		list: (params: NotificationListParams) => ['notifications', 'list', params] as const,
		unreadCount: ['notifications', 'unread-count'] as const,
		preferences: ['notification-preferences'] as const
	},
	/** Every workspace read starts with `workspaces`, so a membership change refreshes them at once. */
	workspaces: {
		all: ['workspaces'] as const,
		list: ['workspaces', 'list'] as const,
		members: (workspaceId: string) => ['workspaces', 'members', workspaceId] as const,
		invitations: (workspaceId: string) => ['workspaces', 'invitations', workspaceId] as const,
		myInvitations: ['workspaces', 'my-invitations'] as const,
		/** Under `pilot-limits`, so invalidating that prefix still refreshes every workspace's limits. */
		limits: (workspaceId: string | null) => ['pilot-limits', workspaceId ?? 'personal'] as const
	},
	github: {
		all: ['github'] as const,
		installations: () => ['github', 'installations'] as const,
		repositories: (installationId: string, params?: GetInstallationRepositoriesParams) =>
			params
				? (['github', 'repositories', installationId, params] as const)
				: (['github', 'repositories', installationId] as const),
		branches: (source: string) => ['github', 'branches', source] as const
	},
	domainPreview: (name: string) => ['domain-preview', name] as const,
	pilotLimits: ['pilot-limits'] as const
};

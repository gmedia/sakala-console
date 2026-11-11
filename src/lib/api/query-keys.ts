import type { GetInstallationRepositoriesParams } from './resources/github';
import type { NotificationListParams } from './resources/notifications';
import type { ProjectsQueryParams } from './resources/projects';
import type { QueryParams } from './resources/admin/common';

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
	/** Every admin read starts with `admin`, so an admin change refreshes them all at once. */
	admin: {
		all: ['admin'] as const,
		overview: (params: QueryParams) => ['admin', 'overview', params] as const,
		users: (params: QueryParams) => ['admin', 'users', params] as const,
		user: (id: string) => ['admin', 'user', id] as const,
		workspaces: (params: QueryParams) => ['admin', 'workspaces', params] as const,
		workspace: (id: string) => ['admin', 'workspace', id] as const,
		limitProfiles: (params: QueryParams) => ['admin', 'limit-profiles', params] as const,
		projects: (params: QueryParams) => ['admin', 'projects', params] as const,
		project: (id: string) => ['admin', 'project', id] as const,
		failures: (params: QueryParams) => ['admin', 'failures', params] as const,
		failureSummary: (params: QueryParams) => ['admin', 'failure-summary', params] as const,
		deployment: (id: string) => ['admin', 'deployment', id] as const,
		deploymentEvents: (id: string) => ['admin', 'deployment-events', id] as const,
		deploymentLogs: (id: string) => ['admin', 'deployment-logs', id] as const,
		agents: (params: QueryParams) => ['admin', 'agents', params] as const,
		agent: (id: string) => ['admin', 'agent', id] as const,
		agentCommands: (id: string, params: QueryParams) =>
			['admin', 'agent-commands', id, params] as const,
		agentCommand: (agentId: string, commandId: string) =>
			['admin', 'agent-command', agentId, commandId] as const,
		feedback: (params: QueryParams) => ['admin', 'feedback', params] as const,
		audit: (params: QueryParams) => ['admin', 'audit', params] as const
	},
	domainPreview: (name: string) => ['domain-preview', name] as const,
	pilotLimits: ['pilot-limits'] as const
};

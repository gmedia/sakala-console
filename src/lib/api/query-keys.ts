export const queryKeys = {
	system: {
		status: ['system', 'status'] as const
	},
	auth: {
		user: ['auth', 'user'] as const
	},
	projects: {
		all: ['projects'] as const,
		list: () => ['projects', 'list'] as const,
		detail: (projectId: string) => ['projects', 'detail', projectId] as const
	},
	deployments: {
		all: ['deployments'] as const,
		detail: (deploymentId: string) => ['deployments', 'detail', deploymentId] as const,
		logs: (deploymentId: string) => ['deployments', 'logs', deploymentId] as const
	},
	notifications: {
		unreadCount: ['notifications', 'unread-count'] as const
	}
};

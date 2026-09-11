import type { BannerStatus } from '../status-config';
import type { DeploymentStep } from '../type';

export const mockTimelineEvents: Record<BannerStatus, DeploymentStep[]> = {
	running: [
		{ key: 'clone', title: 'Cloning repository', status: 'success', timestamp: '08:41:02' },
		{ key: 'analyze', title: 'Menganalisis proyek', status: 'success', timestamp: '08:41:15' },
		{ key: 'build', title: 'Building image', status: 'running' },
		{ key: 'deploy', title: 'Deploy container', status: 'pending' },
		{ key: 'routing', title: 'Menyiapkan routing', status: 'pending' },
		{ key: 'health', title: 'Health check', status: 'pending' }
	],

	success: [
		{ key: 'clone', title: 'Cloning repository', status: 'success', timestamp: '08:41:02' },
		{ key: 'analyze', title: 'Menganalisis proyek', status: 'success', timestamp: '08:41:15' },
		{ key: 'build', title: 'Building image', status: 'success', timestamp: '08:41:38' },
		{ key: 'deploy', title: 'Deploy container', status: 'success', timestamp: '08:41:45' },
		{ key: 'routing', title: 'Menyiapkan routing', status: 'success', timestamp: '08:41:47' },
		{ key: 'health', title: 'Health check', status: 'success', timestamp: '08:41:49' }
	],

	failed: [
		{ key: 'clone', title: 'Cloning repository', status: 'success', timestamp: '08:39:02' },
		{ key: 'analyze', title: 'Menganalisis proyek', status: 'success', timestamp: '08:39:08' },
		{ key: 'build', title: 'Building image', status: 'failed', timestamp: '08:39:12' },
		{ key: 'deploy', title: 'Deploy container', status: 'pending' },
		{ key: 'routing', title: 'Menyiapkan routing', status: 'pending' },
		{ key: 'health', title: 'Health check', status: 'pending' }
	]
};

type LogVariant = 'default' | 'error';
type LogLine = { timestamp: string; message: string; variant?: LogVariant };

export const mockLogs: Record<BannerStatus, LogLine[]> = {
	running: [
		{ timestamp: '08:41:02', message: 'Cloning repository from main...' },
		{ timestamp: '08:41:14', message: 'Repository cloned successfully' },
		{ timestamp: '08:41:15', message: 'Analyzing project structure...' },
		{ timestamp: '08:41:20', message: 'Detected SvelteKit project' },
		{ timestamp: '08:41:22', message: 'Starting build: docker build -t sakala-app .' },
		{ timestamp: '08:41:30', message: 'Step 3/8 : COPY package.json ./' }
	],
	success: [
		{ timestamp: '08:41:02', message: 'Cloning repository from main...' },
		{ timestamp: '08:41:14', message: 'Repository cloned successfully' },
		{ timestamp: '08:41:15', message: 'Analyzing project structure...' },
		{ timestamp: '08:41:38', message: 'Image built successfully' },
		{ timestamp: '08:41:45', message: 'Container deployed' },
		{ timestamp: '08:41:47', message: 'Routing configured successfully' },
		{ timestamp: '08:41:48', message: 'Running health check on /health...' },
		{ timestamp: '08:41:49', message: 'Deployment is live' }
	],
	failed: [
		{ timestamp: '08:39:02', message: 'Cloning repository from feature/checkout-fix...' },
		{ timestamp: '08:39:07', message: 'Repository cloned successfully' },
		{ timestamp: '08:39:08', message: 'Analyzing project structure...' },
		{ timestamp: '08:39:09', message: 'Starting build: docker build -t sakala-app .' },
		{
			timestamp: '08:39:11',
			message: 'Step 5/8 : RUN pnpm build — exited with code 1',
			variant: 'error'
		},
		{ timestamp: '08:39:12', message: 'Build failed: see step 5 output above', variant: 'error' }
	]
};

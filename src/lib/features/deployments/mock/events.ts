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
		{ timestamp: '2026-09-13T01:41:02.000Z', message: 'Cloning repository from main...' },
		{ timestamp: '2026-09-13T01:41:14.000Z', message: 'Repository cloned successfully' },
		{ timestamp: '2026-09-13T01:41:15.000Z', message: 'Analyzing project structure...' },
		{ timestamp: '2026-09-13T01:41:20.000Z', message: 'Detected SvelteKit project' },
		{
			timestamp: '2026-09-13T01:41:22.000Z',
			message: 'Starting build: docker build -t sakala-app .'
		},
		{ timestamp: '2026-09-13T01:41:30.000Z', message: 'Step 3/8 : COPY package.json ./' }
	],
	success: [
		{ timestamp: '2026-09-13T01:41:02.000Z', message: 'Cloning repository from main...' },
		{ timestamp: '2026-09-13T01:41:14.000Z', message: 'Repository cloned successfully' },
		{ timestamp: '2026-09-13T01:41:15.000Z', message: 'Analyzing project structure...' },
		{ timestamp: '2026-09-13T01:41:38.000Z', message: 'Image built successfully' },
		{ timestamp: '2026-09-13T01:41:45.000Z', message: 'Container deployed' },
		{ timestamp: '2026-09-13T01:41:47.000Z', message: 'Routing configured successfully' },
		{ timestamp: '2026-09-13T01:41:48.000Z', message: 'Running health check on /health...' },
		{ timestamp: '2026-09-13T01:41:49.000Z', message: 'Deployment is live' }
	],
	failed: [
		{
			timestamp: '2026-09-13T01:39:02.000Z',
			message: 'Cloning repository from feature/checkout-fix...'
		},
		{ timestamp: '2026-09-13T01:39:07.000Z', message: 'Repository cloned successfully' },
		{ timestamp: '2026-09-13T01:39:08.000Z', message: 'Analyzing project structure...' },
		{
			timestamp: '2026-09-13T01:39:09.000Z',
			message: 'Starting build: docker build -t sakala-app .'
		},
		{
			timestamp: '2026-09-13T01:39:11.000Z',
			message: 'Step 5/8 : RUN pnpm build — exited with code 1',
			variant: 'error'
		},
		{
			timestamp: '2026-09-13T01:39:12.000Z',
			message: 'Build failed: see step 5 output above',
			variant: 'error'
		}
	]
};

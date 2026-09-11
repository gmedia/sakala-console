import type { BannerStatus } from '../status-config';

export interface MockDeploymentDetail {
	projectName: string;
	sequence: number;
	commitHash: string;
	branch: string;
	trigger: string;
	timestamp: string;
	currentStepLabel?: string;
	durationLabel?: string;
	failedStepLabel?: string;
}

export const mockDeploymentDetail: Record<BannerStatus, MockDeploymentDetail> = {
	running: {
		projectName: 'sakala-console',
		sequence: 12,
		commitHash: 'a3f2c9d8e1b74f0c2b9a1d3e5f6789ab12cd34ef',
		branch: 'main',
		trigger: 'Push',
		timestamp: '08:41:02',
		currentStepLabel: 'Building image'
	},
	success: {
		projectName: 'sakala-console',
		sequence: 12,
		commitHash: 'a3f2c9d8e1b74f0c2b9a1d3e5f6789ab12cd34ef',
		branch: 'main',
		trigger: 'Manual redeploy',
		timestamp: '08:41:49',
		durationLabel: '48 detik'
	},
	failed: {
		projectName: 'sakala-console',
		sequence: 11,
		commitHash: 'f9e8d7c6b5a4321098765432abcdef0123456789',
		branch: 'feature/checkout-fix',
		trigger: 'Push',
		timestamp: '08:39:12',
		failedStepLabel: 'Building image'
	}
};

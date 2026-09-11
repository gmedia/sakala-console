import type { BannerStatus } from '../status-config';

export interface MockDeploymentDetail {
	project_name: string;
	sequence: number;
	commit_hash: string;
	branch: string;
	trigger: string;
	started_at: string;
	finished_at?: string;
	cancelled_at?: string;
	current_step_label?: string;
	duration_label?: string;
	failed_step_label?: string;
}

export const mockDeploymentDetail: Record<BannerStatus, MockDeploymentDetail> = {
	running: {
		project_name: 'sakala-console',
		sequence: 12,
		commit_hash: 'a3f2c9d8e1b74f0c2b9a1d3e5f6789ab12cd34ef',
		branch: 'main',
		trigger: 'Push',
		started_at: '08:41:02',
		current_step_label: 'Build project'
	},

	success: {
		project_name: 'sakala-console',
		sequence: 12,
		commit_hash: 'a3f2c9d8e1b74f0c2b9a1d3e5f6789ab12cd34ef',
		branch: 'main',
		trigger: 'Manual redeploy',
		started_at: '08:41:02',
		finished_at: '08:41:49',
		duration_label: '48 detik'
	},

	failed: {
		project_name: 'sakala-console',
		sequence: 11,
		commit_hash: 'f9e8d7c6b5a4321098765432abcdef0123456789',
		branch: 'feature/checkout-fix',
		trigger: 'Push',
		started_at: '08:39:02',
		finished_at: '08:39:12',
		failed_step_label: 'Build project'
	}
};

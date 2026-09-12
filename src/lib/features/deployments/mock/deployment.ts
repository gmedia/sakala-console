import type { BannerStatus } from '../status-config';

export interface MockDeploymentDetail {
	id: string;
	project_id: string;
	sequence: number;
	branch: string;
	status: string;
	trigger: string;
	commit_sha: string | null;
	commit_message: string | null;
	image_reference: string | null;
	requested_resources: unknown[] | null;
	effective_resources: unknown[] | null;
	started_at: string;
	finished_at: string | null;
	cancelled_at: string | null;
	failure_code: string | null;
	failure_summary: string | null;
	created_at: string;
	updated_at: string;
}

export const mockDeploymentDetail: Record<BannerStatus, MockDeploymentDetail> = {
	running: {
		id: 'deployment-12',
		project_id: 'project-1',
		sequence: 12,
		branch: 'main',
		status: 'running',
		trigger: 'webhook',
		commit_sha: 'a3f2c9d8e1b74f0c2b9a1d3e5f6789ab12cd34ef',
		commit_message: 'Update deployment configuration',
		image_reference: null,
		requested_resources: null,
		effective_resources: null,
		started_at: '2026-09-12T08:41:02+07:00',
		finished_at: null,
		cancelled_at: null,
		failure_code: null,
		failure_summary: null,
		created_at: '2026-09-12T08:41:02+07:00',
		updated_at: '2026-09-12T08:41:02+07:00'
	},

	success: {
		id: 'deployment-12',
		project_id: 'project-1',
		sequence: 12,
		branch: 'main',
		status: 'success',
		trigger: 'redeploy',
		commit_sha: 'a3f2c9d8e1b74f0c2b9a1d3e5f6789ab12cd34ef',
		commit_message: 'Update deployment configuration',
		image_reference: null,
		requested_resources: null,
		effective_resources: null,
		started_at: '2026-09-12T08:41:02+07:00',
		finished_at: '2026-09-12T08:41:49+07:00',
		cancelled_at: null,
		failure_code: null,
		failure_summary: null,
		created_at: '2026-09-12T08:41:02+07:00',
		updated_at: '2026-09-12T08:41:49+07:00'
	},

	failed: {
		id: 'deployment-11',
		project_id: 'project-1',
		sequence: 11,
		branch: 'feature/checkout-fix',
		status: 'failed',
		trigger: 'webhook',
		commit_sha: 'f9e8d7c6b5a4321098765432abcdef0123456789',
		commit_message: 'Fix checkout flow',
		image_reference: null,
		requested_resources: null,
		effective_resources: null,
		started_at: '2026-09-12T08:39:02+07:00',
		finished_at: '2026-09-12T08:39:12+07:00',
		cancelled_at: null,
		failure_code: 'BUILD_FAILED',
		failure_summary: 'Build project failed',
		created_at: '2026-09-12T08:39:02+07:00',
		updated_at: '2026-09-12T08:39:12+07:00'
	}
};

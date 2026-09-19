import { describe, it, expect } from 'vitest';
import { ACTIVE_DEPLOYMENT_STATUSES, type Project, type DeploymentStatus } from './type';

// Helper extracting banner status logic from ProjectHeaderBanner
function computeBannerState(project: Pick<Project, 'status' | 'runtime_status'>) {
	let badgeTone: 'success' | 'error' | 'warning' | 'info' | 'neutral';

	if (project.runtime_status === 'not_deployed') {
		badgeTone = 'neutral';
	} else if (project.status === 'failed') {
		badgeTone = 'error';
	} else if (project.status === 'suspended') {
		badgeTone = 'warning';
	} else if (project.status === 'draft') {
		badgeTone = 'neutral';
	} else {
		switch (project.runtime_status) {
			case 'running':
				badgeTone = 'success';
				break;
			case 'failed':
			case 'crashed':
				badgeTone = 'error';
				break;
			case 'deploying':
				badgeTone = 'info';
				break;
			case 'stopped':
			default:
				badgeTone = 'neutral';
				break;
		}
	}

	let displayStatus: string;
	if (project.runtime_status === 'not_deployed') {
		displayStatus = 'Belum deploy';
	} else if (project.status === 'failed' || project.runtime_status === 'failed') {
		displayStatus = 'Failed';
	} else if (project.status === 'suspended') {
		displayStatus = 'Suspended';
	} else if (project.status === 'draft') {
		displayStatus = 'Draft';
	} else {
		displayStatus = project.runtime_status.replace('_', ' ');
	}

	return { badgeTone, displayStatus };
}

// Helper extracting card status logic from DeploymentCard
function computeDeploymentCardState(status: DeploymentStatus) {
	const isActive = ACTIVE_DEPLOYMENT_STATUSES.includes(status);

	let badgeClass: string;
	let label: string;

	if (status === 'succeeded') {
		badgeClass = 'bg-success/10 text-success';
		label = 'Selesai';
	} else if (status === 'failed' || status === 'cancelled') {
		badgeClass = 'bg-error/10 text-error';
		label = status === 'failed' ? 'Failed' : 'Cancelled';
	} else if (isActive) {
		badgeClass = 'bg-warning/10 text-warning';
		label = 'Deploying';
	} else {
		badgeClass = 'bg-muted/20 text-muted';
		label = status;
	}

	return { badgeClass, label, isActive };
}

describe('Project and Deployment Status Contract Regression', () => {
	describe('ProjectStatus & RuntimeStatus', () => {
		it('correctly maps project with active status and running runtime to success tone', () => {
			const state = computeBannerState({
				status: 'active',
				runtime_status: 'running'
			});

			expect(state.badgeTone).toBe('success');
			expect(state.displayStatus).toBe('running');
		});

		it('correctly maps suspended and draft project statuses', () => {
			const suspended = computeBannerState({
				status: 'suspended',
				runtime_status: 'running'
			});
			expect(suspended.badgeTone).toBe('warning');
			expect(suspended.displayStatus).toBe('Suspended');

			const draft = computeBannerState({
				status: 'draft',
				runtime_status: 'not_deployed'
			});
			expect(draft.badgeTone).toBe('neutral');
			expect(draft.displayStatus).toBe('Belum deploy');
		});
	});

	describe('DeploymentStatus', () => {
		it('correctly styles succeeded deployment as success with Selesai label', () => {
			const state = computeDeploymentCardState('succeeded');

			expect(state.badgeClass).toBe('bg-success/10 text-success');
			expect(state.label).toBe('Selesai');
			expect(state.isActive).toBe(false);
		});

		it('identifies active pipeline stages like health_checking and deploying as active', () => {
			const healthChecking = computeDeploymentCardState('health_checking');
			expect(healthChecking.isActive).toBe(true);
			expect(healthChecking.badgeClass).toBe('bg-warning/10 text-warning');
			expect(healthChecking.label).toBe('Deploying');

			const deploying = computeDeploymentCardState('deploying');
			expect(deploying.isActive).toBe(true);
			expect(deploying.badgeClass).toBe('bg-warning/10 text-warning');
			expect(deploying.label).toBe('Deploying');
		});

		it('includes all non-terminal stages in ACTIVE_DEPLOYMENT_STATUSES for polling', () => {
			expect(ACTIVE_DEPLOYMENT_STATUSES).toContain('queued');
			expect(ACTIVE_DEPLOYMENT_STATUSES).toContain('cloning');
			expect(ACTIVE_DEPLOYMENT_STATUSES).toContain('analyzing');
			expect(ACTIVE_DEPLOYMENT_STATUSES).toContain('building');
			expect(ACTIVE_DEPLOYMENT_STATUSES).toContain('deploying');
			expect(ACTIVE_DEPLOYMENT_STATUSES).toContain('routing');
			expect(ACTIVE_DEPLOYMENT_STATUSES).toContain('health_checking');

			expect(ACTIVE_DEPLOYMENT_STATUSES).not.toContain('succeeded');
			expect(ACTIVE_DEPLOYMENT_STATUSES).not.toContain('failed');
			expect(ACTIVE_DEPLOYMENT_STATUSES).not.toContain('cancelled');
		});
	});
});

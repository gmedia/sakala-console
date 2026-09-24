import { describe, expect, it } from 'vitest';
import type { Deployment, DeploymentEvent } from '$lib/api/resources/deployment';
import { normalizeDeploymentTimeline } from './deployment-normalization';

function createDeployment(overrides: Partial<Deployment> = {}): Deployment {
	return {
		id: 'deployment-1',
		project_id: 'project-1',
		sequence: 1,
		branch: 'main',
		status: 'queued',
		trigger: 'manual',
		commit_sha: null,
		commit_message: null,
		image_reference: null,
		requested_resources: null,
		effective_resources: null,
		applied_resources: null,
		finalization_deferred: false,
		finalization_deferred_reason: '',
		agent_node_id: null,
		started_at: '2026-09-20T10:00:00Z',
		finished_at: null,
		cancelled_at: null,
		failure_code: null,
		failure_summary: null,
		failure: null,
		created_at: '2026-09-20T10:00:00Z',
		updated_at: '2026-09-20T10:00:00Z',
		...overrides
	};
}

function createEvent(overrides: Partial<DeploymentEvent> = {}): DeploymentEvent {
	return {
		sequence: 1,
		level: 'info',
		type: 'deployment.queued',
		message: 'Deployment queued',
		metadata: null,
		occurred_at: '2026-09-20T10:00:00Z',
		...overrides
	};
}

describe('normalizeDeploymentTimeline', () => {
	it('marks Queued as running when deployment status is queued', () => {
		const deployment = createDeployment({
			status: 'queued'
		});

		const events = [
			createEvent({
				sequence: 1,
				type: 'deployment.queued'
			})
		];

		const result = normalizeDeploymentTimeline(deployment, events);

		expect(result[0]).toMatchObject({
			key: 'Queued',
			title: 'Menunggu antrian',
			status: 'running',
			timestamp: '2026-09-20T10:00:00Z'
		});

		expect(result.slice(1).every((step) => step.status === 'pending')).toBe(true);
	});

	it('marks previous stages as success and current stage as running', () => {
		const deployment = createDeployment({
			status: 'building'
		});

		const events = [
			createEvent({
				sequence: 1,
				type: 'deployment.queued'
			}),
			createEvent({
				sequence: 2,
				type: 'deployment.cloning',
				occurred_at: '2026-09-20T10:01:00Z'
			}),
			createEvent({
				sequence: 3,
				type: 'deployment.analyzing',
				occurred_at: '2026-09-20T10:02:00Z'
			}),
			createEvent({
				sequence: 4,
				type: 'deployment.building',
				occurred_at: '2026-09-20T10:03:00Z'
			})
		];

		const result = normalizeDeploymentTimeline(deployment, events);

		expect(result.map((step) => step.status)).toEqual([
			'success',
			'success',
			'success',
			'running',
			'pending',
			'pending',
			'pending'
		]);

		expect(result[3]).toMatchObject({
			key: 'Building',
			status: 'running',
			timestamp: '2026-09-20T10:03:00Z'
		});
	});

	it('marks all pipeline stages as success when deployment succeeds', () => {
		const deployment = createDeployment({
			status: 'succeeded',
			finished_at: '2026-09-20T10:10:00Z'
		});

		const events = [
			createEvent({
				sequence: 1,
				type: 'deployment.queued'
			}),
			createEvent({
				sequence: 2,
				type: 'deployment.building'
			}),
			createEvent({
				sequence: 3,
				type: 'deployment.succeeded'
			})
		];

		const result = normalizeDeploymentTimeline(deployment, events);

		expect(result).toHaveLength(7);
		expect(result.every((step) => step.status === 'success')).toBe(true);
	});

	it('marks the latest known pipeline stage as failed', () => {
		const deployment = createDeployment({
			status: 'failed',
			failure_code: 'BUILD_FAILED',
			failure_summary: 'Build failed'
		});

		const events = [
			createEvent({
				sequence: 1,
				type: 'deployment.queued'
			}),
			createEvent({
				sequence: 2,
				type: 'deployment.cloning'
			}),
			createEvent({
				sequence: 3,
				type: 'deployment.building'
			}),
			createEvent({
				sequence: 4,
				type: 'deployment.failed',
				level: 'error'
			})
		];

		const result = normalizeDeploymentTimeline(deployment, events);

		expect(result.map((step) => step.status)).toEqual([
			'success',
			'success',
			'success',
			'failed',
			'pending',
			'pending',
			'pending'
		]);

		expect(result[3]).toMatchObject({
			key: 'Building',
			status: 'failed'
		});
	});

	it('marks stages before the failed stage as successful', () => {
		const deployment = createDeployment({
			status: 'failed'
		});

		const events = [
			createEvent({
				sequence: 1,
				type: 'deployment.queued'
			}),
			createEvent({
				sequence: 2,
				type: 'deployment.building'
			}),
			createEvent({
				sequence: 3,
				type: 'deployment.failed'
			})
		];

		const result = normalizeDeploymentTimeline(deployment, events);

		expect(result.map((step) => step.status)).toEqual([
			'success',
			'success',
			'success',
			'failed',
			'pending',
			'pending',
			'pending'
		]);
	});

	it('sorts events by sequence before resolving the current stage', () => {
		const deployment = createDeployment({
			status: 'building'
		});

		const events = [
			createEvent({
				sequence: 3,
				type: 'deployment.building'
			}),
			createEvent({
				sequence: 1,
				type: 'deployment.queued'
			}),
			createEvent({
				sequence: 2,
				type: 'deployment.cloning'
			})
		];

		const result = normalizeDeploymentTimeline(deployment, events);

		expect(result.map((step) => step.status)).toEqual([
			'success',
			'success',
			'success',
			'running',
			'pending',
			'pending',
			'pending'
		]);
	});

	it('keeps only the first event when sequence is duplicated', () => {
		const deployment = createDeployment({
			status: 'cloning'
		});

		const events = [
			createEvent({
				sequence: 1,
				type: 'deployment.queued',
				occurred_at: '2026-09-20T10:00:00Z'
			}),
			createEvent({
				sequence: 1,
				type: 'deployment.cloning',
				occurred_at: '2026-09-20T10:01:00Z'
			})
		];

		const result = normalizeDeploymentTimeline(deployment, events);

		expect(result[0]).toMatchObject({
			key: 'Queued',
			timestamp: '2026-09-20T10:00:00Z'
		});

		expect(result[1]).toMatchObject({
			key: 'Cloning',
			timestamp: undefined
		});
	});

	it('keeps all stages pending when a failed deployment has no pipeline events at all', () => {
		const deployment = createDeployment({ status: 'failed' });
		const result = normalizeDeploymentTimeline(deployment, []);

		expect(result.every((step) => step.status === 'pending')).toBe(true);
	});

	it('ignores unknown event types without breaking the timeline', () => {
		const deployment = createDeployment({
			status: 'building'
		});

		const events = [
			createEvent({
				sequence: 1,
				type: 'deployment.unknown'
			}),
			createEvent({
				sequence: 2,
				type: 'deployment.building'
			})
		];

		const result = normalizeDeploymentTimeline(deployment, events);

		expect(result[3]).toMatchObject({
			key: 'Building',
			status: 'running'
		});

		expect(result[0].timestamp).toBeUndefined();
	});

	it('ignores events with null type', () => {
		const deployment = createDeployment({
			status: 'cloning'
		});

		const events = [
			createEvent({
				sequence: 1,
				type: null
			})
		];

		const result = normalizeDeploymentTimeline(deployment, events);

		expect(result[0].timestamp).toBeUndefined();
		expect(result[1]).toMatchObject({
			key: 'Cloning',
			status: 'running'
		});
	});

	it('treats cancelled the same as failed for the current stage', () => {
		const deployment = createDeployment({ status: 'cancelled' });
		const events = [
			createEvent({ sequence: 1, type: 'deployment.queued' }),
			createEvent({ sequence: 2, type: 'deployment.building' }),
			createEvent({ sequence: 3, type: 'deployment.cancelled' })
		];

		const result = normalizeDeploymentTimeline(deployment, events);

		expect(result.map((step) => step.status)).toEqual([
			'success',
			'success',
			'success',
			'failed',
			'pending',
			'pending',
			'pending'
		]);
	});

	it('falls back to all-pending for an unrecognized deployment status, without throwing', () => {
		const deployment = createDeployment({ status: 'rolled_back' });
		const result = normalizeDeploymentTimeline(deployment, []);

		expect(() => normalizeDeploymentTimeline(deployment, [])).not.toThrow();
		expect(result.every((step) => step.status === 'pending')).toBe(true);
	});
});

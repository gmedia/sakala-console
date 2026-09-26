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
		finalization_deferred_reason: null,
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
		type: 'deployment.checkout.started',
		message: 'Deployment event',
		metadata: null,
		occurred_at: '2026-09-20T10:00:00Z',
		...overrides
	};
}

describe('normalizeDeploymentTimeline', () => {
	it('returns exactly 5 pipeline stages (Analyzing & HealthChecking removed)', () => {
		const deployment = createDeployment({ status: 'queued' });
		const result = normalizeDeploymentTimeline(deployment, []);

		expect(result).toHaveLength(5);
		expect(result.map((s) => s.key)).toEqual([
			'Queued',
			'Cloning',
			'Building',
			'Deploying',
			'Routing'
		]);
	});

	it('marks Queued as running when deployment status is queued', () => {
		const deployment = createDeployment({ status: 'queued' });
		const result = normalizeDeploymentTimeline(deployment, []);

		expect(result[0]).toMatchObject({
			key: 'Queued',
			title: 'Menunggu antrean',
			status: 'running'
		});
		expect(result.slice(1).every((s) => s.status === 'pending')).toBe(true);
	});

	it('maps deployment.checkout.started to Cloning stage', () => {
		const deployment = createDeployment({ status: 'cloning' });
		const events = [
			createEvent({
				sequence: 1,
				type: 'deployment.checkout.started',
				occurred_at: '2026-09-20T10:00:00Z'
			})
		];

		const result = normalizeDeploymentTimeline(deployment, events);
		const cloning = result.find((s) => s.key === 'Cloning');

		expect(cloning?.timestamp).toBe('2026-09-20T10:00:00Z');
		expect(cloning?.status).toBe('running');
	});

	it('maps deployment.build.started to Building stage', () => {
		const deployment = createDeployment({ status: 'building' });
		const events = [
			createEvent({
				sequence: 1,
				type: 'deployment.checkout.started',
				occurred_at: '2026-09-20T10:00:00Z'
			}),
			createEvent({
				sequence: 2,
				type: 'deployment.build.started',
				occurred_at: '2026-09-20T10:01:00Z'
			})
		];

		const result = normalizeDeploymentTimeline(deployment, events);
		const building = result.find((s) => s.key === 'Building');

		expect(building?.timestamp).toBe('2026-09-20T10:01:00Z');
		expect(building?.status).toBe('running');
	});

	it('maps deployment.container.started to Deploying stage', () => {
		const deployment = createDeployment({ status: 'deploying' });
		const events = [
			createEvent({
				sequence: 1,
				type: 'deployment.container.started',
				occurred_at: '2026-09-20T10:02:00Z'
			})
		];

		const result = normalizeDeploymentTimeline(deployment, events);
		const deploying = result.find((s) => s.key === 'Deploying');

		expect(deploying?.timestamp).toBe('2026-09-20T10:02:00Z');
		expect(deploying?.status).toBe('running');
	});

	it('maps deployment.runtime.ready to Routing stage', () => {
		const deployment = createDeployment({ status: 'routing' });
		const events = [
			createEvent({
				sequence: 1,
				type: 'deployment.runtime.ready',
				occurred_at: '2026-09-20T10:03:00Z'
			})
		];

		const result = normalizeDeploymentTimeline(deployment, events);
		const routing = result.find((s) => s.key === 'Routing');

		expect(routing?.timestamp).toBe('2026-09-20T10:03:00Z');
		expect(routing?.status).toBe('running');
	});

	it('marks previous stages as success and current stage as running (Agent v4)', () => {
		const deployment = createDeployment({ status: 'building' });
		const events = [
			createEvent({
				sequence: 1,
				type: 'deployment.checkout.started',
				occurred_at: '2026-09-20T10:00:00Z'
			}),
			createEvent({
				sequence: 2,
				type: 'deployment.build.started',
				occurred_at: '2026-09-20T10:01:00Z'
			})
		];

		const result = normalizeDeploymentTimeline(deployment, events);

		expect(result.map((s) => s.status)).toEqual([
			'success',
			'success',
			'running',
			'pending',
			'pending'
		]);

		expect(result[2]).toMatchObject({
			key: 'Building',
			status: 'running',
			timestamp: '2026-09-20T10:01:00Z'
		});
	});

	it('marks all 5 pipeline stages as success when deployment succeeds', () => {
		const deployment = createDeployment({
			status: 'succeeded',
			finished_at: '2026-09-20T10:10:00Z'
		});

		const events = [
			createEvent({ sequence: 1, type: 'deployment.checkout.started' }),
			createEvent({ sequence: 2, type: 'deployment.build.started' }),
			createEvent({ sequence: 3, type: 'deployment.container.started' }),
			createEvent({ sequence: 4, type: 'deployment.runtime.ready' })
		];

		const result = normalizeDeploymentTimeline(deployment, events);

		expect(result).toHaveLength(5);
		expect(result.every((s) => s.status === 'success')).toBe(true);
	});

	it('marks the latest known pipeline stage as failed (Agent v4, failed at build)', () => {
		const deployment = createDeployment({
			status: 'failed',
			failure_code: 'runtime_build_failed',
			failure_summary: 'Build failed'
		});

		const events = [
			createEvent({ sequence: 1, type: 'deployment.checkout.started' }),
			createEvent({ sequence: 2, type: 'deployment.build.started' }),
			createEvent({ sequence: 3, type: 'deployment.failed', level: 'error' })
		];

		const result = normalizeDeploymentTimeline(deployment, events);

		expect(result.map((s) => s.status)).toEqual([
			'success',
			'success',
			'failed',
			'pending',
			'pending'
		]);

		expect(result[2]).toMatchObject({
			key: 'Building',
			status: 'failed'
		});
	});

	it('marks stages before the failed stage as successful', () => {
		const deployment = createDeployment({ status: 'failed' });

		const events = [
			createEvent({ sequence: 1, type: 'deployment.checkout.started' }),
			createEvent({ sequence: 2, type: 'deployment.build.started' }),
			createEvent({ sequence: 3, type: 'deployment.failed' })
		];

		const result = normalizeDeploymentTimeline(deployment, events);

		expect(result.slice(0, 2).every((s) => s.status === 'success')).toBe(true);
		expect(result[2].status).toBe('failed');
	});

	it('detects failed step at Cloning when build never started', () => {
		const deployment = createDeployment({ status: 'failed' });

		const events = [
			createEvent({ sequence: 1, type: 'deployment.checkout.started' }),
			createEvent({ sequence: 2, type: 'deployment.failed', level: 'error' })
		];

		const result = normalizeDeploymentTimeline(deployment, events);
		const failedStep = result.find((s) => s.status === 'failed');

		expect(failedStep?.key).toBe('Cloning');
	});

	it('treats cancelled the same as failed for the current stage', () => {
		const deployment = createDeployment({ status: 'cancelled' });
		const events = [
			createEvent({ sequence: 1, type: 'deployment.checkout.started' }),
			createEvent({ sequence: 2, type: 'deployment.build.started' }),
			createEvent({ sequence: 3, type: 'deployment.cancelled' })
		];

		const result = normalizeDeploymentTimeline(deployment, events);

		expect(result[2]).toMatchObject({
			key: 'Building',
			status: 'failed'
		});
	});

	it('sorts events by sequence before resolving the current stage', () => {
		const deployment = createDeployment({ status: 'building' });

		const events = [
			createEvent({ sequence: 3, type: 'deployment.build.started' }),
			createEvent({ sequence: 1, type: 'deployment.checkout.started' })
		];

		const result = normalizeDeploymentTimeline(deployment, events);

		expect(result.map((s) => s.status)).toEqual([
			'success',
			'success',
			'running',
			'pending',
			'pending'
		]);
	});

	it('keeps only the first event when sequence is duplicated', () => {
		const deployment = createDeployment({ status: 'cloning' });

		const events = [
			createEvent({
				sequence: 1,
				type: 'deployment.checkout.started',
				occurred_at: '2026-09-20T10:00:00Z'
			}),
			createEvent({
				sequence: 1,
				type: 'deployment.build.started',
				occurred_at: '2026-09-20T10:01:00Z'
			})
		];

		const result = normalizeDeploymentTimeline(deployment, events);
		const cloning = result.find((s) => s.key === 'Cloning');

		expect(cloning?.timestamp).toBe('2026-09-20T10:00:00Z');
	});

	it('keeps all stages pending when a failed deployment has no pipeline events', () => {
		const deployment = createDeployment({ status: 'failed' });
		const result = normalizeDeploymentTimeline(deployment, []);

		expect(result.every((s) => s.status === 'pending')).toBe(true);
	});

	it('ignores unknown event types without breaking the timeline', () => {
		const deployment = createDeployment({ status: 'building' });

		const events = [
			createEvent({ sequence: 1, type: 'deployment.unknown' }),
			createEvent({ sequence: 2, type: 'deployment.build.started' })
		];

		const result = normalizeDeploymentTimeline(deployment, events);
		const building = result.find((s) => s.key === 'Building');

		expect(building?.status).toBe('running');
		expect(result[0].timestamp).toBeUndefined();
	});

	it('ignores events with null type', () => {
		const deployment = createDeployment({ status: 'cloning' });

		const events = [createEvent({ sequence: 1, type: null })];

		const result = normalizeDeploymentTimeline(deployment, events);
		const cloning = result.find((s) => s.key === 'Cloning');

		expect(result[0].timestamp).toBeUndefined();
		expect(cloning?.status).toBe('running');
	});

	it('falls back to all-pending for legacy unrecognized status (analyzing)', () => {
		const deployment = createDeployment({ status: 'analyzing' });
		const result = normalizeDeploymentTimeline(deployment, []);

		expect(() => normalizeDeploymentTimeline(deployment, [])).not.toThrow();
		expect(result.every((s) => s.status === 'pending')).toBe(true);
	});

	it('falls back to all-pending for legacy unrecognized status (health_checking)', () => {
		const deployment = createDeployment({ status: 'health_checking' });
		const result = normalizeDeploymentTimeline(deployment, []);

		expect(result.every((s) => s.status === 'pending')).toBe(true);
	});
});

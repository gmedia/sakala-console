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
		is_active: false,
		cancel_requested_at: null,
		queue_state: null,
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
	it('shows when the failed step stopped, not when it began', () => {
		const result = normalizeDeploymentTimeline(
			createDeployment({ status: 'failed', finished_at: '2026-09-20T10:09:00Z' }),
			[
				createEvent({
					sequence: 1,
					type: 'deployment.checkout.started',
					occurred_at: '2026-09-20T10:01:00Z'
				}),
				createEvent({
					sequence: 2,
					type: 'deployment.build.started',
					occurred_at: '2026-09-20T10:02:00Z'
				})
			]
		);

		expect(result.find((step) => step.key === 'Cloning')?.timestamp).toBe('2026-09-20T10:01:00Z');
		expect(result.find((step) => step.key === 'Building')).toMatchObject({
			status: 'failed',
			timestamp: '2026-09-20T10:09:00Z'
		});
	});

	it('lists every real stage while queued, health before routing', () => {
		const result = normalizeDeploymentTimeline(createDeployment({ status: 'queued' }), []);

		expect(result.map((s) => s.key)).toEqual([
			'Queued',
			'Cloning',
			'Analyzing',
			'Building',
			'Deploying',
			'HealthChecking',
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

	it.each([
		['deployment.analysis.started', 'analyzing', 'Analyzing'],
		['deployment.health.started', 'health_checking', 'HealthChecking'],
		['deployment.route.started', 'routing', 'Routing']
	] as const)('maps %s to its own stage', (type, status, key) => {
		const events = [createEvent({ sequence: 1, type, occurred_at: '2026-09-20T10:03:00Z' })];

		const result = normalizeDeploymentTimeline(createDeployment({ status }), events);

		expect(result.find((s) => s.key === key)).toMatchObject({
			status: 'running',
			timestamp: '2026-09-20T10:03:00Z'
		});
	});

	it('does not read deployment.runtime.ready as routing', () => {
		const events = [createEvent({ sequence: 1, type: 'deployment.runtime.ready' })];

		const result = normalizeDeploymentTimeline(createDeployment({ status: 'succeeded' }), events);

		expect(result).toEqual([]);
	});

	it('drops a stage the agent passed without reporting it, instead of calling it done', () => {
		const events = [
			createEvent({ sequence: 1, type: 'deployment.checkout.started' }),
			createEvent({ sequence: 2, type: 'deployment.build.started' }),
			createEvent({ sequence: 3, type: 'deployment.container.started' })
		];

		const result = normalizeDeploymentTimeline(createDeployment({ status: 'succeeded' }), events);

		expect(result.map((s) => s.key)).toEqual(['Queued', 'Cloning', 'Building', 'Deploying']);
		expect(result.every((s) => s.status === 'success')).toBe(true);
	});

	it('shows no stage after the one a deployment failed at', () => {
		const events = [
			createEvent({ sequence: 1, type: 'deployment.checkout.started' }),
			createEvent({ sequence: 2, type: 'deployment.build.started' })
		];

		const result = normalizeDeploymentTimeline(createDeployment({ status: 'failed' }), events);

		expect(result.map((s) => s.key)).toEqual(['Queued', 'Cloning', 'Building']);
		expect(result.at(-1)?.status).toBe('failed');
	});

	it('trusts failure.stage over the events', () => {
		const deployment = createDeployment({
			status: 'failed',
			failure: {
				code: 'runtime_health_check_failed',
				category: 'health',
				summary: 'x',
				recovery_hint: 'y',
				user_fixable: true,
				detail: null,
				stage: 'health_checking'
			}
		});

		const result = normalizeDeploymentTimeline(deployment, []);

		expect(result.at(-1)).toMatchObject({ key: 'HealthChecking', status: 'failed' });
	});

	it('claims nothing when a started deployment has no stage record left', () => {
		expect(normalizeDeploymentTimeline(createDeployment({ status: 'failed' }), [])).toEqual([]);
	});

	it('places a failure that never started in the queue', () => {
		const deployment = createDeployment({ status: 'failed', started_at: null });

		expect(normalizeDeploymentTimeline(deployment, [])).toEqual([
			expect.objectContaining({ key: 'Queued', status: 'failed' })
		]);
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
			'pending',
			'pending'
		]);

		expect(result[2]).toMatchObject({
			key: 'Building',
			status: 'running',
			timestamp: '2026-09-20T10:01:00Z'
		});
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

		expect(result.map((s) => s.status)).toEqual(['success', 'success', 'failed']);

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

	it('marks the stage a deployment was cancelled at as cancelled, not failed', () => {
		const deployment = createDeployment({ status: 'cancelled' });
		const events = [
			createEvent({ sequence: 1, type: 'deployment.checkout.started' }),
			createEvent({ sequence: 2, type: 'deployment.build.started' }),
			createEvent({ sequence: 3, type: 'deployment.cancelled' })
		];

		const result = normalizeDeploymentTimeline(deployment, events);

		expect(result[2]).toMatchObject({
			key: 'Building',
			status: 'cancelled'
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
});

describe('how long each stage took', () => {
	const events = [
		createEvent({
			sequence: 1,
			type: 'deployment.checkout.started',
			occurred_at: '2026-09-20T10:00:10Z'
		}),
		createEvent({
			sequence: 2,
			type: 'deployment.build.started',
			occurred_at: '2026-09-20T10:00:20Z'
		})
	];
	const durationOf = (deployment: Deployment, key: string) =>
		normalizeDeploymentTimeline(deployment, events).find((step) => step.key === key)
			?.durationSeconds;

	it('runs from the start of a stage to the start of the next', () => {
		const deployment = createDeployment({
			status: 'failed',
			started_at: '2026-09-20T10:00:05Z',
			finished_at: '2026-09-20T10:01:33Z',
			failure: { stage: 'building' } as Deployment['failure']
		});

		expect(durationOf(deployment, 'Queued')).toBe(10);
		expect(durationOf(deployment, 'Cloning')).toBe(10);
		expect(durationOf(deployment, 'Building')).toBe(73);
	});

	it('claims nothing for a stage still running or not started', () => {
		const deployment = createDeployment({ status: 'building' });

		expect(durationOf(deployment, 'Cloning')).toBe(10);
		expect(durationOf(deployment, 'Building')).toBeUndefined();
		expect(durationOf(deployment, 'Deploying')).toBeUndefined();
	});

	it('claims nothing for the queue while the deployment is still in it', () => {
		const deployment = createDeployment({
			status: 'queued',
			started_at: '2026-09-20T10:00:05Z'
		});

		expect(durationOf(deployment, 'Queued')).toBeUndefined();
	});

	it('claims nothing when the clock runs backwards', () => {
		const deployment = createDeployment({
			status: 'failed',
			created_at: '2026-09-20T11:00:00Z',
			finished_at: '2026-09-20T10:01:33Z',
			failure: { stage: 'building' } as Deployment['failure']
		});

		expect(durationOf(deployment, 'Queued')).toBeUndefined();
	});
});

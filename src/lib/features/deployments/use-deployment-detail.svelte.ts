import { usePrivateChannel } from '$lib/features/realtime/use-channel.svelte';
import { SequenceGuard } from '$lib/features/realtime/sequence-guard';
import { createDeploymentQuery, createDeploymentEventsQuery } from './queries';
import { normalizeDeploymentTimeline } from './deployment-normalization';
import {
	getBannerStatusFromDeploymentStatus,
	deriveLiveInfoTimestamp,
	type StatusDisplayInput
} from './status-config';
import {
	deriveCurrentStepLabel,
	deriveFailedStepLabel,
	deriveDurationLabel,
	getDeploymentErrorConfig,
	TERMINAL_STATUSES,
	deriveLastUpdateTimestamp
} from './deployment-presentation';

type RealtimePayload = { sequence?: number };

export function useDeploymentDetail(projectId: () => string, deploymentId: () => string) {
	const deploymentQuery = createDeploymentQuery(projectId, deploymentId);
	const isTerminal = () => {
		const status = deploymentQuery.data?.data.status;
		return status ? TERMINAL_STATUSES.has(status) : false;
	};
	const deploymentEventsQuery = createDeploymentEventsQuery(projectId, deploymentId, isTerminal);

	let currentDeploymentId = $state('');
	let guard = $state(new SequenceGuard());

	$effect(() => {
		const id = deploymentId();

		if (!id || id === currentDeploymentId) return;

		currentDeploymentId = id;
		guard = new SequenceGuard();
	});

	usePrivateChannel(() => `deployment.${deploymentId()}`, {
		'.deployment.event.created': (payload: unknown) => {
			const seq = (payload as RealtimePayload).sequence;
			if (typeof seq !== 'number' || !guard.accept(seq)) return;
			deploymentEventsQuery.refetch();
		},
		'.deployment.updated': (payload: unknown) => {
			const seq = (payload as RealtimePayload).sequence;
			if (typeof seq !== 'number' || !guard.accept(seq)) return;
			deploymentQuery.refetch();
		}
	});

	const deployment = $derived(deploymentQuery.data?.data);
	const events = $derived(deploymentEventsQuery.data?.data ?? []);
	const steps = $derived(deployment ? normalizeDeploymentTimeline(deployment, events) : []);

	const lastUpdateTimestamp = $derived(deriveLastUpdateTimestamp(events));

	const bannerInput = $derived<StatusDisplayInput>(
		deployment
			? {
					status: getBannerStatusFromDeploymentStatus(deployment.status),
					currentStepLabel: deriveCurrentStepLabel(steps),
					durationLabel: deriveDurationLabel(deployment.started_at, deployment.finished_at),
					failedStepLabel: deriveFailedStepLabel(steps),
					failureSummary: deployment.failure?.summary ?? deployment.failure_summary ?? undefined,
					recoveryHint: deployment.failure?.recovery_hint ?? undefined
				}
			: { status: 'running' }
	);

	const infoTimestamp = $derived(
		deployment
			? deriveLiveInfoTimestamp({
					status: bannerInput.status,
					steps,
					startedAtLabel: deployment.started_at
				})
			: '-'
	);

	return {
		deploymentQuery,
		deploymentEventsQuery,
		get deployment() {
			return deployment;
		},
		get steps() {
			return steps;
		},
		get bannerInput() {
			return bannerInput;
		},
		get isLoading() {
			return deploymentQuery.isPending || deploymentEventsQuery.isPending;
		},
		get infoTimestamp() {
			return infoTimestamp;
		},
		get lastUpdateTimestamp() {
			return lastUpdateTimestamp;
		},
		get deploymentError() {
			return deploymentQuery.isError ? getDeploymentErrorConfig(deploymentQuery.error) : null;
		},
		get eventsError() {
			return deploymentEventsQuery.isError
				? getDeploymentErrorConfig(deploymentEventsQuery.error)
				: null;
		}
	};
}

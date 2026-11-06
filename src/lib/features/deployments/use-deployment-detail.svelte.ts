import { useQueryClient } from '@tanstack/svelte-query';
import { createCoalescedTask } from '$lib/features/realtime/coalesced-task';
import { usePrivateChannel } from '$lib/features/realtime/use-channel.svelte';
import { SequenceGuard } from '$lib/features/realtime/sequence-guard';
import { realtimeState } from '$lib/realtime/connection-state.svelte';
import { isRateLimitError } from '$lib/api/rate-limit';
import {
	applyRealtimeDeploymentEvent,
	applyRealtimeDeploymentUpdate,
	createDeploymentQuery,
	createDeploymentEventsQuery
} from './queries';
import { normalizeDeploymentTimeline } from './deployment-normalization';
import {
	getBannerStatusFromDeploymentStatus,
	deriveLiveInfoTimestamp,
	type ServingState,
	type StatusDisplayInput
} from './status-config';
import {
	deriveCurrentStepLabel,
	deriveFailedStepLabel,
	deriveDurationLabel,
	getDeploymentErrorConfig,
	TERMINAL_STATUSES,
	deriveLastUpdateTimestamp,
	formatDeploymentTime
} from './deployment-presentation';
import { getProjectPublicUrl, isProjectServing } from '$lib/features/projects/presentation';
import { createProjectQuery, requestProjectRefresh } from '$lib/features/projects/queries';

type RealtimePayload = { sequence?: number };

export function useDeploymentDetail(projectId: () => string, deploymentId: () => string) {
	const client = useQueryClient();
	const deploymentQuery = createDeploymentQuery(projectId, deploymentId);
	const isTerminal = () => {
		const status = deploymentQuery.data?.data.status;
		return status ? TERMINAL_STATUSES.has(status) : false;
	};
	const deploymentEventsQuery = createDeploymentEventsQuery(projectId, deploymentId, isTerminal);

	let currentDeploymentId = $state('');
	let deploymentGuard = $state(new SequenceGuard());
	let eventsGuard = $state(new SequenceGuard());

	$effect(() => {
		const id = deploymentId();

		if (!id || id === currentDeploymentId) return;

		currentDeploymentId = id;
		deploymentGuard = new SequenceGuard();
		eventsGuard = new SequenceGuard();
	});

	// Reads overlapping the one in flight join it, instead of cancelling it and starting over.
	const deploymentRefresh = createCoalescedTask(() => {
		void deploymentQuery.refetch({ cancelRefetch: false });
	});
	const eventsRefresh = createCoalescedTask(() => {
		void deploymentEventsQuery.refetch({ cancelRefetch: false });
	});

	$effect(() => () => {
		deploymentRefresh.dispose();
		eventsRefresh.dispose();
	});

	usePrivateChannel(() => `deployment.${deploymentId()}`, {
		'.deployment.event.created': (payload: unknown) => {
			const seq = (payload as RealtimePayload).sequence;
			if (typeof seq !== 'number' || !eventsGuard.accept(seq)) return;
			if (!applyRealtimeDeploymentEvent(client, projectId(), deploymentId(), payload)) {
				eventsRefresh.request();
			}
		},
		'.deployment.updated': (payload: unknown) => {
			const seq = (payload as RealtimePayload).sequence;
			if (typeof seq !== 'number' || !deploymentGuard.accept(seq)) return;
			if (!applyRealtimeDeploymentUpdate(client, projectId(), deploymentId(), payload)) {
				deploymentRefresh.request();
				eventsRefresh.request();
			}
		}
	});

	// Broadcasts sent while the socket was down never arrive.
	let wasDisconnected = false;
	$effect(() => {
		const connected = realtimeState.status === 'connected';
		if (connected && wasDisconnected) {
			deploymentRefresh.request();
			eventsRefresh.request();
		}
		if (!connected && realtimeState.status !== 'idle') wasDisconnected = true;
		if (connected) wasDisconnected = false;
	});

	const projectQuery = createProjectQuery(projectId);

	const publicUrl = $derived(getProjectPublicUrl(projectQuery.data));

	const project = $derived(projectQuery.data ?? null);
	const deployment = $derived(deploymentQuery.data?.data);

	// Finishing changes what the project serves, and the cached copy would still say otherwise.
	let lastStatus: string | undefined;
	$effect(() => {
		const status = deployment?.status;
		if (lastStatus && status && status !== lastStatus && TERMINAL_STATUSES.has(status)) {
			requestProjectRefresh(client, projectId());
		}
		lastStatus = status;
	});

	const servingState = $derived.by<ServingState>(() => {
		if (!deployment?.is_active) {
			return deploymentQuery.data?.servingUnconfirmed ? 'unconfirmed' : 'superseded';
		}
		if (project?.runtime_status === 'crashed') return 'crash_looping';
		return project && !isProjectServing(project) ? 'not_serving' : 'live';
	});
	const events = $derived(deploymentEventsQuery.data?.data ?? []);
	const steps = $derived(deployment ? normalizeDeploymentTimeline(deployment, events) : []);

	const lastUpdateTimestamp = $derived(
		deployment
			? deriveLastUpdateTimestamp(events, {
					created_at: deployment.created_at,
					started_at: deployment.started_at,
					finished_at: deployment.finished_at,
					cancelled_at: deployment.cancelled_at
				})
			: '-'
	);

	const bannerInput = $derived<StatusDisplayInput>(
		deployment
			? {
					status: getBannerStatusFromDeploymentStatus(deployment.status),
					currentStepLabel: deriveCurrentStepLabel(steps),
					durationLabel: deriveDurationLabel(deployment.started_at, deployment.finished_at),
					failedStepLabel: deriveFailedStepLabel(steps),
					failureCategory: deployment.failure?.category,
					failureCode: deployment.failure_code ?? undefined,
					failureSummary: deployment.failure?.summary ?? deployment.failure_summary ?? undefined,
					failureDetail: deployment.failure?.detail ?? undefined,
					userFixable: deployment.failure?.user_fixable,
					recoveryHint: deployment.failure?.recovery_hint ?? undefined,
					servingState,
					queueState: deployment.queue_state,
					cancelRequested: Boolean(deployment.cancel_requested_at)
				}
			: { status: 'running' }
	);

	const infoTimestamp = $derived(
		deployment
			? deriveLiveInfoTimestamp({
					status: bannerInput.status,
					startedAtLabel: formatDeploymentTime(deployment.started_at),
					finishedAtLabel:
						(deployment.finished_at ?? deployment.cancelled_at)
							? formatDeploymentTime(deployment.finished_at ?? deployment.cancelled_at)
							: undefined
				})
			: '-'
	);

	return {
		deploymentQuery,
		deploymentEventsQuery,
		get deployment() {
			return deployment;
		},
		get project() {
			return project;
		},
		get publicUrl() {
			return publicUrl;
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
		get isWaitingForRateLimit() {
			return (
				isRateLimitError(deploymentQuery.error) || isRateLimitError(deploymentEventsQuery.error)
			);
		},
		get eventsError() {
			// Events already on screen stay there: a failed refresh does not make them wrong.
			return deploymentEventsQuery.isError && events.length === 0
				? getDeploymentErrorConfig(deploymentEventsQuery.error)
				: null;
		}
	};
}

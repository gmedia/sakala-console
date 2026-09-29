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
	deriveLastUpdateTimestamp,
	formatDeploymentTime
} from './deployment-presentation';
import { createQuery } from '@tanstack/svelte-query';
import { getProject } from '$lib/features/projects/api';
import { queryKeys } from '$lib/api/query-keys';

type RealtimePayload = { sequence?: number };

export function useDeploymentDetail(projectId: () => string, deploymentId: () => string) {
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

	usePrivateChannel(() => `deployment.${deploymentId()}`, {
		'.deployment.event.created': (payload: unknown) => {
			const seq = (payload as RealtimePayload).sequence;
			if (typeof seq !== 'number' || !eventsGuard.accept(seq)) return;
			deploymentEventsQuery.refetch();
		},
		'.deployment.updated': (payload: unknown) => {
			const seq = (payload as RealtimePayload).sequence;
			if (typeof seq !== 'number' || !deploymentGuard.accept(seq)) return;
			deploymentQuery.refetch();
		}
	});

	const projectQuery = createQuery(() => ({
		queryKey: queryKeys.projects.detail(projectId()),
		queryFn: () => getProject(projectId()),
		enabled: !!projectId()
	}));

	const publicUrl = $derived.by(() => {
		const domain = projectQuery.data?.default_domain;
		if (!domain) return null;
		return domain.startsWith('http') ? domain : `https://${domain}`;
	});

	const deployment = $derived(deploymentQuery.data?.data);
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
					failureCode: deployment.failure_code ?? undefined,
					failureSummary: deployment.failure?.summary ?? deployment.failure_summary ?? undefined,
					recoveryHint: deployment.failure?.recovery_hint ?? undefined
				}
			: { status: 'running' }
	);

	const infoTimestamp = $derived(
		deployment
			? deriveLiveInfoTimestamp({
					status: bannerInput.status,
					startedAtLabel: formatDeploymentTime(deployment.started_at),
					finishedAtLabel: deployment.finished_at
						? formatDeploymentTime(deployment.finished_at)
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
		get eventsError() {
			return deploymentEventsQuery.isError
				? getDeploymentErrorConfig(deploymentEventsQuery.error)
				: null;
		}
	};
}

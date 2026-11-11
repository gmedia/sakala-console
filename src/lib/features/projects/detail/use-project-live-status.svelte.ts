import { useQueryClient } from '@tanstack/svelte-query';
import { SequenceGuard } from '$lib/features/realtime/sequence-guard';
import { usePrivateChannel } from '$lib/features/realtime/use-channel.svelte';
import { deriveProjectHeaderState, toRuntimeStatus } from '../presentation';
import {
	createRecentDeploymentsQuery,
	isRunningDeployment,
	projectKeys,
	requestProjectRefresh
} from '../queries';
import type { Deployment, PaginatedDeployments, Project } from '../type';

type DeploymentUpdatedPayload = {
	sequence?: unknown;
	project_runtime_status?: unknown;
	deployment_id?: unknown;
	status?: unknown;
};

/**
 * Keeps the project header in step with what runs: `deployment.updated` on the running deployment,
 * or on the active one when nothing runs (a crash arrives there), with polling as the fallback.
 * Query cache stays the source of what renders.
 */
export function useProjectLiveStatus(project: () => Project) {
	const client = useQueryClient();
	const projectId = () => project().id;

	const recentQuery = createRecentDeploymentsQuery(projectId);
	const deployments = $derived(recentQuery.data?.data ?? []);
	const header = $derived(deriveProjectHeaderState(project(), deployments));
	const running = $derived(deployments.find(isRunningDeployment));
	const channelDeploymentId = $derived(running?.id ?? project().active_deployment_id ?? null);

	function refreshProject() {
		requestProjectRefresh(client, projectId());
	}

	// The header reads a running deployment from the list, so only a new deployment or the end of
	// one changes anything a read could tell it.
	let lastSeen: { id: string; running: boolean } | undefined;
	$effect(() => {
		const latest = deployments.reduce<(typeof deployments)[number] | undefined>(
			(newest, deployment) =>
				!newest || deployment.sequence > newest.sequence ? deployment : newest,
			undefined
		);
		const seen = latest ? { id: latest.id, running: isRunningDeployment(latest) } : undefined;
		if (lastSeen && seen && (seen.id !== lastSeen.id || seen.running !== lastSeen.running)) {
			refreshProject();
		}
		lastSeen = seen;
	});

	let guard = new SequenceGuard();
	$effect(() => {
		void channelDeploymentId;
		guard = new SequenceGuard();
	});

	usePrivateChannel(() => (channelDeploymentId ? `deployment.${channelDeploymentId}` : null), {
		'.deployment.updated': (payload: unknown) => {
			const {
				sequence,
				project_runtime_status: runtimeStatus,
				deployment_id: deploymentId,
				status
			} = payload as DeploymentUpdatedPayload;
			if (typeof sequence === 'number' && !guard.accept(sequence)) return;

			const nextStatus = typeof runtimeStatus === 'string' ? toRuntimeStatus(runtimeStatus) : null;
			if (nextStatus) {
				client.setQueryData<Project>(projectKeys.detail(projectId()), (current) =>
					current ? { ...current, runtime_status: nextStatus } : current
				);
			}

			if (typeof deploymentId !== 'string' || typeof status !== 'string') {
				refreshProject();
				return;
			}

			client.setQueriesData<PaginatedDeployments>(
				{ queryKey: projectKeys.deployments(projectId()) },
				(list) =>
					list && {
						...list,
						data: list.data.map((deployment) =>
							deployment.id === deploymentId
								? { ...deployment, status: status as Deployment['status'] }
								: deployment
						)
					}
			);

			// A step forward is in the list now. The end of a deployment changes the project as well.
			if (!isRunningDeployment({ status: status as Deployment['status'] })) refreshProject();
		}
	});

	return {
		get header() {
			return header;
		}
	};
}

import { useQueryClient } from '@tanstack/svelte-query';
import { untrack } from 'svelte';
import { queryKeys } from '$lib/api/query-keys';
import type { Project as ListedProject } from '$lib/api/resources/projects';
import { createCoalescedTask } from '$lib/features/realtime/coalesced-task';
import { usePrivateChannel } from '$lib/features/realtime/use-channel.svelte';
import { ACTIVE_DEPLOYMENT_STATUSES, type DeploymentStatus } from './type';

type ListedDeployment = Pick<ListedProject, 'latest_deployment'>;

/** The deployments on the page that can still change, each named once. */
export function inProgressDeploymentIds(projects: readonly ListedDeployment[]): string[] {
	const ids = projects.flatMap(({ latest_deployment: deployment }) =>
		deployment && ACTIVE_DEPLOYMENT_STATUSES.includes(deployment.status as DeploymentStatus)
			? [deployment.id]
			: []
	);
	return ids.filter((id, index) => ids.indexOf(id) === index);
}

/**
 * Keeps the project list current while something on it deploys. `users.{id}` only carries
 * notifications, so each step of a deployment comes from its own `deployment.{id}` channel, and a
 * step re-reads the list. A channel stays open across re-reads and closes once its deployment has
 * finished or left the page. A deployment started elsewhere, such as by a webhook, is announced
 * nowhere, so `resolveProjectListPollInterval` still catches those.
 */
export function useProjectListLive(projects: () => readonly ListedDeployment[]) {
	const client = useQueryClient();
	const refresh = createCoalescedTask(() =>
		client.invalidateQueries({ queryKey: queryKeys.projects.lists })
	);
	// Plain bookkeeping, read only inside `untrack`: nothing renders from it.
	let watched: Record<string, () => void> = {};

	$effect(() => {
		const ids = inProgressDeploymentIds(projects());

		untrack(() => {
			const next: Record<string, () => void> = {};
			for (const id of ids) {
				next[id] =
					watched[id] ??
					$effect.root(() => {
						usePrivateChannel(`deployment.${id}`, {
							'.deployment.updated': () => refresh.request()
						});
					});
			}
			for (const [id, stop] of Object.entries(watched)) {
				if (!(id in next)) stop();
			}
			watched = next;
		});
	});

	$effect(() => () => {
		for (const stop of Object.values(watched)) stop();
		watched = {};
		refresh.dispose();
	});
}

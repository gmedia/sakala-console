import { useQueryClient } from '@tanstack/svelte-query';
import { z } from 'zod';
import { createCoalescedTask } from '$lib/features/realtime/coalesced-task';
import { usePrivateChannel } from '$lib/features/realtime/use-channel.svelte';
import {
	flattenLogPages,
	getDeploymentLogErrorConfig,
	isNewestPageCached,
	LOG_REALTIME_COALESCE_MS
} from './deployment-logs';
import {
	applyRealtimeLogLine,
	createDeploymentLogsQuery,
	createDeploymentLogsTailQuery,
	refreshDeploymentLogsTail
} from './queries';

const realtimeLogSchema = z.object({
	log_sequence: z.number(),
	stream: z.enum(['stdout', 'stderr', 'system']),
	message: z.string(),
	recorded_at: z.string()
});

export function useDeploymentLogs(
	projectId: () => string,
	deploymentId: () => string,
	isTerminal: () => boolean
) {
	const client = useQueryClient();
	const logsQuery = createDeploymentLogsQuery(projectId, deploymentId);
	const tailQuery = createDeploymentLogsTailQuery(projectId, deploymentId, isTerminal);

	let following = $state(true);
	let paused = $state(false);

	const pages = $derived(logsQuery.data?.pages ?? []);
	const lines = $derived(flattenLogPages(pages));
	const hasNewerPages = $derived(logsQuery.data ? !isNewestPageCached(logsQuery.data) : false);

	let refreshRunning = false;
	let refreshQueued = false;

	// One read for a burst, and none for a background tab until someone looks at it.
	const tailRefresh = createCoalescedTask(async () => {
		if (refreshRunning) {
			refreshQueued = true;
			return;
		}
		refreshRunning = true;
		refreshQueued = false;
		await tailQuery.refetch({ cancelRefetch: false });
		refreshRunning = false;
		if (refreshQueued) requestTailRefresh();
	}, LOG_REALTIME_COALESCE_MS);

	function requestTailRefresh() {
		tailRefresh.request();
	}

	$effect(() => () => tailRefresh.dispose());

	usePrivateChannel(() => `deployment.${deploymentId()}`, {
		'.deployment.log.created': (payload: unknown) => {
			const parsed = realtimeLogSchema.safeParse(payload);
			if (!parsed.success) {
				requestTailRefresh();
				return;
			}

			const { log_sequence: sequence, stream, message, recorded_at } = parsed.data;
			const outcome = applyRealtimeLogLine(
				client,
				deploymentId(),
				{ sequence, stream, message, recorded_at },
				{ canEvict: following }
			);
			if (outcome === 'needs-tail') requestTailRefresh();
		}
	});

	// Lines reported right before the terminal status can be lost with a dropped broadcast.
	let wasRunning = false;
	$effect(() => {
		const terminal = isTerminal();
		if (terminal && wasRunning) requestTailRefresh();
		wasRunning = !terminal;
	});

	const loadError = $derived(logsQuery.isError ? logsQuery.error : null);
	const refreshError = $derived(tailQuery.isError ? tailQuery.error : null);
	const error = $derived(loadError ?? refreshError);

	return {
		get lines() {
			return lines;
		},
		get isLoading() {
			return logsQuery.isPending;
		},
		get isLoadingOlder() {
			return logsQuery.isFetchingNextPage;
		},
		get hasOlderPages() {
			return logsQuery.hasNextPage;
		},
		get hasNewerPages() {
			return hasNewerPages;
		},
		get following() {
			return following;
		},
		set following(value: boolean) {
			following = value;
		},
		get paused() {
			return paused;
		},
		get error() {
			return error ? getDeploymentLogErrorConfig(error) : null;
		},
		get isRetrying() {
			return logsQuery.isFetching || tailQuery.isFetching;
		},
		loadOlder() {
			if (logsQuery.isFetching) return;
			// Stay on the line being read while older ones appear above it.
			following = false;
			void logsQuery.fetchNextPage();
		},
		pause() {
			paused = true;
			following = false;
		},
		goToLatest() {
			paused = false;
			following = true;
			if (hasNewerPages) {
				// On failure the jump button stays, so the reader can simply try again.
				refreshDeploymentLogsTail(client, projectId(), deploymentId(), { force: true }).catch(
					() => undefined
				);
			}
		},
		retry() {
			if (logsQuery.isFetchNextPageError) void logsQuery.fetchNextPage();
			else if (logsQuery.isError) void logsQuery.refetch();
			else void tailQuery.refetch();
		}
	};
}

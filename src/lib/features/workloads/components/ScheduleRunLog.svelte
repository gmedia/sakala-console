<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import DeploymentLogConsole from '$lib/features/deployments/components/DeploymentLogConsole.svelte';
	import { getDeploymentLogErrorConfig } from '$lib/features/deployments/deployment-logs';
	import { createScheduleRunLogsQuery } from '../queries';
	import { SCHEDULE_COPY } from '../schedules';

	type Props = {
		projectId: string;
		scheduleId: string;
		runId: string;
		/** Still running: the output is read again until it ends. */
		open: boolean;
		/** Whether a container ever started; a skipped or missed run has no output. */
		ran: boolean;
		labelledBy: string;
	};

	let { projectId, scheduleId, runId, open, ran, labelledBy }: Props = $props();

	const logsQuery = createScheduleRunLogsQuery(
		() => projectId,
		() => scheduleId,
		() => (ran ? runId : ''),
		() => open
	);

	const lines = $derived(logsQuery.data?.pages.flatMap((page) => page.data) ?? []);
	const error = $derived(logsQuery.isError ? getDeploymentLogErrorConfig(logsQuery.error) : null);
</script>

<div class="flex flex-col gap-2" data-testid="schedule-run-log">
	<div class="h-64 min-h-0">
		<DeploymentLogConsole {lines} {labelledBy} live={open}>
			<div class="font-sans text-sm text-terminal-text">
				{#if !ran}
					<p>{SCHEDULE_COPY.logNotRun}</p>
				{:else if logsQuery.isPending}
					<p role="status">Memuat log...</p>
				{:else if error}
					<p class="font-semibold">{SCHEDULE_COPY.logFailed}</p>
					<p class="mt-1 text-terminal-muted">{error.description}</p>
				{:else}
					<p>{SCHEDULE_COPY.logEmpty}</p>
				{/if}
			</div>
		</DeploymentLogConsole>
	</div>
	{#if logsQuery.hasNextPage}
		<div>
			<Button
				variant="secondary"
				size="sm"
				onclick={() => logsQuery.fetchNextPage()}
				disabled={logsQuery.isFetchingNextPage}
			>
				{SCHEDULE_COPY.logLoadMore}
			</Button>
		</div>
	{/if}
</div>

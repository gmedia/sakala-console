<script lang="ts">
	import StatusIndicator from '$lib/components/ui/StatusIndicator.svelte';
	import { cn } from '$lib/utils/cn';
	import { formatDuration } from '$lib/utils/date';
	import { formatDeploymentTime } from '../deployment-presentation';
	import { getTimelineItemDisplay } from '../status-config';
	import type { StatusDeployment } from '../type';

	type Props = {
		status: StatusDeployment;
		title?: string;
		timestamp?: string;
		durationSeconds?: number;
		last?: boolean;
	};

	let { status, title = '', timestamp, durationSeconds, last = false }: Props = $props();

	let display = $derived(
		getTimelineItemDisplay({
			status,
			title,
			timestamp: timestamp ? formatDeploymentTime(timestamp) : undefined,
			duration: durationSeconds === undefined ? undefined : formatDuration(durationSeconds)
		})
	);
</script>

<li
	class={cn('relative flex gap-3', !last && 'pb-3')}
	aria-current={status === 'running' ? 'step' : undefined}
>
	{#if !last}
		<span class="absolute top-6 bottom-0.5 left-2.5 w-px bg-border-strong/40" aria-hidden="true"
		></span>
	{/if}
	<StatusIndicator {status} size="sm" showLabel={false} />
	<div class="flex min-w-0 flex-col">
		<span
			class={cn(
				'text-sm font-medium',
				status === 'pending' ? 'text-muted' : 'text-foreground',
				status === 'failed' && 'text-error'
			)}
		>
			{display.title}
		</span>
		{#if display.subtitle}
			<span class="text-xs text-muted tabular-nums">{display.subtitle}</span>
		{/if}
	</div>
</li>

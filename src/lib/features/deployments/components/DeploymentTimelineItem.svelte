<script lang="ts">
	import StatusIndicator from '$lib/components/ui/StatusIndicator.svelte';
	import { cn } from '$lib/utils/cn';
	import { formatDuration } from '$lib/utils/date';
	import { formatDeploymentTime } from '../deployment-presentation';
	import { getTimelineItemDisplay, getTimelineStatusSuffix } from '../status-config';
	import { getReusedStepSegments, type ImageSource } from '../image-reuse-presentation';
	import type { StatusDeployment } from '../type';
	import ImageSourceText from './ImageSourceText.svelte';
	import type { ProjectMonorepo } from '$lib/features/projects/type';
	import MonorepoSummary from '$lib/features/projects/components/monorepo/MonorepoSummary.svelte';

	type Props = {
		status: StatusDeployment;
		title?: string;
		timestamp?: string;
		durationSeconds?: number;
		last?: boolean;
		/** The workspace this deployment built from, with the commands it really ran. */
		monorepo?: ProjectMonorepo;
		/** For the step of a reused image: the deployment that built it, linked from the title. */
		imageSource?: ImageSource;
		projectId?: string;
	};

	let {
		status,
		title = '',
		timestamp,
		durationSeconds,
		last = false,
		monorepo,
		imageSource,
		projectId
	}: Props = $props();

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
	class={cn('relative', !last && 'pb-3')}
	aria-current={status === 'running' ? 'step' : undefined}
>
	{#if !last}
		<span class="absolute top-6 bottom-0.5 left-2.5 w-px bg-border-strong/40" aria-hidden="true"
		></span>
	{/if}
	<div class="flex gap-3">
		<StatusIndicator {status} size="sm" showLabel={false} />
		<div class="flex min-w-0 flex-col">
			<span
				class={cn(
					'text-sm font-medium',
					status === 'pending' ? 'text-muted' : 'text-foreground',
					status === 'failed' && 'text-error'
				)}
			>
				{#if imageSource && projectId}
					<ImageSourceText
						{projectId}
						segments={getReusedStepSegments(imageSource)}
					/>{getTimelineStatusSuffix(status)}
				{:else}
					{display.title}
				{/if}
			</span>
			{#if display.subtitle}
				<span class="text-xs text-muted tabular-nums">{display.subtitle}</span>
			{/if}
		</div>
	</div>
	<!-- Under the row, lined up with the title, so the step's icon stays beside its name. -->
	{#if monorepo}
		<div class="pl-8">
			<MonorepoSummary {monorepo} compact />
		</div>
	{/if}
</li>

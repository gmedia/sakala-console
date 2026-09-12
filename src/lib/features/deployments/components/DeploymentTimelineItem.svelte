<script lang="ts">
	import StatusIndicator from '$lib/components/ui/StatusIndicator.svelte';
	import { getTimelineItemDisplay } from '../status-config';
	import type { StatusDeployment } from '../type';

	type Props = {
		status: StatusDeployment;
		title?: string;
		timestamp?: string;
		showSubtitle?: boolean;
		emphasizeRunning?: boolean;
	};

	let {
		status,
		title = '',
		timestamp,
		showSubtitle = true,
		emphasizeRunning = false
	}: Props = $props();

	let display = $derived(getTimelineItemDisplay({ status, title, timestamp, showSubtitle }));
	let isRunningEmphasized = $derived(emphasizeRunning && status === 'running');
</script>

<div class="flex items-center gap-1">
	<StatusIndicator
		{status}
		size="lg"
		showLabel={false}
		colorClassOverride={isRunningEmphasized ? 'bg-warning-dark text-white' : undefined}
		showIcon={!isRunningEmphasized}
	/>
	<div class="ml-4 flex flex-col gap-1">
		<span class="text-md font-montserrat-medium">{display.title}</span>
		{#if display.subtitle}
			<span class="text-sm text-muted font-montserrat">{display.subtitle}</span>
		{/if}
	</div>
</div>

<script lang="ts">
	import StatusIndicator from '$lib/components/ui/StatusIndicator.svelte';
	import { getTimelineItemDisplay } from '../status-config';
	import type { StatusDeployment } from '../type';

	type Props = {
		status: StatusDeployment;
		title?: string;
		timestamp?: string;
	};

	let { status, title = '', timestamp }: Props = $props();

	let display = $derived(getTimelineItemDisplay({ status, title, timestamp }));
</script>

<div class="flex items-center gap-1">
	<StatusIndicator {status} size="md" showLabel={false} />
	<div class="ml-4 flex flex-col gap-1">
		<span class="text-md font-montserrat-medium">{display.title}</span>
		{#if display.subtitle}
			<span class="text-sm text-muted font-montserrat">{display.subtitle}</span>
		{/if}
	</div>
</div>

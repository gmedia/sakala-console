<script lang="ts">
	import type { DeploymentStep } from '../type';
	import DeploymentTimelineItem from './DeploymentTimelineItem.svelte';

	type Props = {
		steps: DeploymentStep[];
		showSubtitle?: boolean;
		emphasizeRunning?: boolean;
	};

	let { steps, showSubtitle = true, emphasizeRunning = false }: Props = $props();
</script>

<div class="rounded-lg">
	<div class="flex flex-col gap-2">
		{#each steps as step (step.key)}
			<DeploymentTimelineItem
				status={step.status}
				title={step.title}
				timestamp={step.timestamp}
				{showSubtitle}
				{emphasizeRunning}
			/>
		{/each}
	</div>
</div>

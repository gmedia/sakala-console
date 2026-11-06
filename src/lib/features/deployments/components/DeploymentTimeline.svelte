<script lang="ts">
	import type { DeploymentStep } from '../type';
	import DeploymentTimelineItem from './DeploymentTimelineItem.svelte';

	let { steps }: { steps: DeploymentStep[] } = $props();
</script>

<ol class="flex flex-col">
	{#each steps as step, index (step.key)}
		<DeploymentTimelineItem
			status={step.status}
			title={step.title}
			timestamp={step.timestamp}
			durationSeconds={step.durationSeconds}
			last={index === steps.length - 1}
		/>
	{/each}
</ol>

<script lang="ts">
	import type { DeploymentStep } from '../type';
	import DeploymentTimelineItem from './DeploymentTimelineItem.svelte';

	let { steps, projectId }: { steps: DeploymentStep[]; projectId?: string } = $props();
</script>

<ol class="flex flex-col">
	{#each steps as step, index (step.key)}
		<DeploymentTimelineItem
			status={step.status}
			title={step.title}
			timestamp={step.timestamp}
			durationSeconds={step.durationSeconds}
			monorepo={step.monorepo}
			imageSource={step.imageSource}
			{projectId}
			last={index === steps.length - 1}
		/>
	{/each}
</ol>

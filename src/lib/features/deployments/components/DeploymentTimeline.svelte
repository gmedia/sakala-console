<script lang="ts">
	import type { DeploymentStep } from '../type';
	import DeploymentTimelineItem from './DeploymentTimelineItem.svelte';

	type Props = {
		steps: DeploymentStep[];
	};

	let { steps }: Props = $props();
</script>

<div class="rounded-lg py-2">
	<div class="flex flex-col gap-2">
		{#each steps as step (step.key)}
			<DeploymentTimelineItem status={step.status} title={step.title} timestamp={step.timestamp} />
		{/each}
	</div>
</div>

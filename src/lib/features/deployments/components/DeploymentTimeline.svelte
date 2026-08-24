<script lang="ts">
	import DeploymentTimelineItem from './DeploymentTimelineItem.svelte';
	import type { DeploymentStep } from '../../projects/type';

	type Props = {
		steps: DeploymentStep[];
	};

	let { steps }: Props = $props();
</script>

<div class="rounded-lg py-2">
	<div class="flex flex-col gap-2">
		{#each steps as step (step.key)}
			<DeploymentTimelineItem status={step.status} title={step.title} />
		{/each}
	</div>
</div>

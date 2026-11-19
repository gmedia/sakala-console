<script lang="ts">
	import { resolveRoute } from '$app/paths';
	import type { ImageSourceSegment } from '../image-reuse-presentation';

	type Props = {
		projectId: string;
		segments: readonly ImageSourceSegment[];
	};

	let { projectId, segments }: Props = $props();

	const deploymentHref = (deploymentId: string) =>
		resolveRoute('/(app)/projects/[id]/deployments/[deploymentId]', {
			id: projectId,
			deploymentId
		});
</script>

{#each segments as segment, index (index)}
	{#if segment.deploymentId}
		<a
			href={deploymentHref(segment.deploymentId)}
			class="font-mono text-primary-dark tabular-nums underline underline-offset-2"
			>{segment.text}</a
		>
	{:else}
		{segment.text}
	{/if}
{/each}

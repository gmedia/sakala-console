<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import { useProjectRedeploy } from '../../detail/use-project-redeploy.svelte';
	import { REDEPLOY_REQUIRED_COPY } from '../../presentation';
	import type { Project } from '../../type';

	let { project, message }: { project: Pick<Project, 'id' | 'branch'>; message: string } = $props();

	const redeploy = useProjectRedeploy(() => project);
</script>

<div
	role="status"
	class="flex flex-col justify-between gap-3 rounded-control border border-warning/30 bg-warning/10 px-4 py-3 md:flex-row md:items-center"
>
	<p class="min-w-0 text-sm text-foreground">{message}</p>
	<Button onclick={() => redeploy.trigger()} disabled={redeploy.isProcessing}>
		{redeploy.isProcessing ? REDEPLOY_REQUIRED_COPY.busy : REDEPLOY_REQUIRED_COPY.action}
	</Button>
</div>
{#if redeploy.errorMessage}
	<p role="alert" class="text-sm text-error-dark">
		{redeploy.errorMessage}
	</p>
{/if}

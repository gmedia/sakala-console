<script lang="ts">
	import Badge from '$lib/components/ui/Badge.svelte';
	import { runStatusView } from '../schedules';

	let { status }: { status: string } = $props();

	const view = $derived(runStatusView(status));
</script>

<Badge tone={view.tone}>
	{#if view.open}
		<span class="sr-only">Sedang berjalan:</span>
	{/if}
	{view.label}
</Badge>

<script lang="ts">
	import Badge from '$lib/components/ui/Badge.svelte';
	import type { Database } from '$lib/api/resources/databases';
	import { databaseStatusView } from '../presentation';

	let { database }: { database: Pick<Database, 'status' | 'last_failure'> } = $props();

	const view = $derived(databaseStatusView(database));
</script>

<Badge tone={view.tone}>
	{#if view.transitional}
		<span class="sr-only">Sedang berjalan:</span>
	{/if}
	{view.label}
</Badge>

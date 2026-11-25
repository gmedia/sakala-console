<script lang="ts">
	import Badge from '$lib/components/ui/Badge.svelte';
	import type { Valkey } from '$lib/api/resources/valkeys';
	import { valkeyStatusView } from '../presentation';

	type Props = { valkey: Pick<Valkey, 'status' | 'last_failure'> & Partial<Pick<Valkey, 'mode'>> };

	let { valkey }: Props = $props();

	const view = $derived(valkeyStatusView(valkey));
</script>

<Badge tone={view.tone}>
	{#if view.transitional}
		<span class="sr-only">Sedang berjalan:</span>
	{/if}
	{view.label}
</Badge>

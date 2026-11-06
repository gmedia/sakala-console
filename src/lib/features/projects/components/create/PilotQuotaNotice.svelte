<script lang="ts">
	import type { PilotLimits } from '$lib/api/resources/pilot-limits';
	import { getProjectQuotaNotice } from '../../presentation';

	let { limits }: { limits: PilotLimits | undefined } = $props();

	const notice = $derived(limits ? getProjectQuotaNotice(limits) : null);
</script>

{#if notice?.reached}
	<p
		role="alert"
		class="rounded-lg border border-warning/40 bg-warning/10 p-3 font-montserrat text-sm text-foreground"
	>
		{notice.message}
	</p>
{:else if notice}
	<p class="font-montserrat text-sm text-foreground/70">{notice.message}</p>
{/if}

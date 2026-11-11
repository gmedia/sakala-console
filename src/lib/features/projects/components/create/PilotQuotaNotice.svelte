<script lang="ts">
	import type { PilotLimits } from '$lib/api/resources/pilot-limits';
	import { getProjectQuotaNotice } from '../../presentation';

	type Props = {
		limits: PilotLimits | undefined;
		/** Set for a team workspace. */
		workspaceName?: string;
	};

	let { limits, workspaceName }: Props = $props();

	const notice = $derived(limits ? getProjectQuotaNotice(limits, workspaceName) : null);
</script>

{#if notice?.reached}
	<p
		role="alert"
		class="rounded-control border border-warning/40 bg-accent-soft p-3 text-sm text-foreground"
	>
		{notice.message}
	</p>
{:else if notice}
	<p class="text-sm text-muted">{notice.message}</p>
{/if}

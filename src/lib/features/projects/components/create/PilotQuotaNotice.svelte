<script lang="ts">
	import type { PilotLimits } from '$lib/api/resources/pilot-limits';
	import Badge from '$lib/components/ui/Badge.svelte';
	import { getProjectQuotaNotice } from '../../presentation';

	type Props = {
		limits: PilotLimits | undefined;
		/** Set for a team workspace. */
		workspaceName?: string;
		/** A badge while there is room, for a list's toolbar; the full sentence once it is used up. */
		compact?: boolean;
	};

	let { limits, workspaceName, compact = false }: Props = $props();

	const notice = $derived(limits ? getProjectQuotaNotice(limits, workspaceName) : null);
</script>

{#if notice?.reached}
	<p
		role="alert"
		class="rounded-control border border-warning/40 bg-accent-soft p-3 text-sm text-foreground"
	>
		{notice.message}
	</p>
{:else if notice && compact}
	<!-- Its own width in a column too (the wizard), not stretched across it. -->
	<Badge tone="neutral" class="w-fit"
		><span data-testid="project-quota-badge">{notice.badge}</span></Badge
	>
{:else if notice}
	<p class="text-sm text-muted">{notice.message}</p>
{/if}

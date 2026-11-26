<script lang="ts">
	import type { PilotLimits } from '$lib/api/resources/pilot-limits';
	import PanelHelp from '$lib/components/panel/PanelHelp.svelte';
	import LearnMore from '$lib/components/ui/LearnMore.svelte';
	import {
		workspaceBuildsPerHourSummary,
		workspaceIdleSleepSummary,
		workspaceReplicasSummary
	} from '../limits';
	import { WORKSPACE_HELP_LINKS, WORKSPACE_PAGE_COPY as COPY } from '../panel';
	import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLE_ORDER } from '../presentation';

	/**
	 * Bantuan only: what each role may do and how the limits work stay folded, since the role and the
	 * usage already sit under the workspace's name.
	 */
	let { limits }: { limits: PilotLimits | undefined } = $props();

	const idleSleep = $derived(limits ? workspaceIdleSleepSummary(limits) : null);
	const replicas = $derived(limits ? workspaceReplicasSummary(limits) : null);
	const buildsPerHour = $derived(limits ? workspaceBuildsPerHourSummary(limits) : null);
</script>

<PanelHelp links={WORKSPACE_HELP_LINKS} testid="workspace-help">
	<LearnMore topic={COPY.rolesTopic} label={COPY.roles} testid="workspace-roles-help">
		<dl class="flex flex-col gap-2">
			{#each ROLE_ORDER as role (role)}
				<div>
					<dt class="font-medium text-foreground">{ROLE_LABELS[role]}</dt>
					<dd>{ROLE_DESCRIPTIONS[role]}</dd>
				</div>
			{/each}
		</dl>
	</LearnMore>
	{#if limits}
		<LearnMore topic={COPY.limitsTopic} label={COPY.limits} testid="workspace-limits-help">
			{#if idleSleep}
				<p data-testid="workspace-idle-sleep">{idleSleep}</p>
			{/if}
			{#if replicas}
				<p data-testid="workspace-replicas">{replicas}</p>
			{/if}
			{#if buildsPerHour}
				<p data-testid="workspace-builds-per-hour">{buildsPerHour}</p>
			{/if}
			<p>{COPY.limitsShared}</p>
		</LearnMore>
	{/if}
</PanelHelp>

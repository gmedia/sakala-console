<script lang="ts">
	import type { Valkey } from '$lib/api/resources/valkeys';
	import PanelHelp from '$lib/components/panel/PanelHelp.svelte';
	import PanelNextSteps from '$lib/components/panel/PanelNextSteps.svelte';
	import PanelSummary from '$lib/components/panel/PanelSummary.svelte';
	import SummaryRow from '$lib/components/panel/SummaryRow.svelte';
	import LearnMore from '$lib/components/ui/LearnMore.svelte';
	import { formatDate } from '$lib/utils/date';
	import { deriveValkeySteps, VALKEY_PANEL_COPY as COPY } from '../panel';
	import { formatMegabytes, valkeyModeView } from '../presentation';
	import ValkeyModeLabel from './ValkeyModeLabel.svelte';
	import ValkeyStatusBadge from './ValkeyStatusBadge.svelte';
	import ValkeyUsageHelp from './ValkeyUsageHelp.svelte';

	type Props = { valkey: Valkey; canManage: boolean };

	let { valkey, canManage }: Props = $props();

	const mode = $derived(valkeyModeView(valkey.mode));
	const steps = $derived(deriveValkeySteps(valkey, canManage));
	const countFormat = new Intl.NumberFormat('id-ID');
</script>

<PanelSummary testid="valkey-summary">
	<SummaryRow label={COPY.status}><ValkeyStatusBadge {valkey} /></SummaryRow>
	<SummaryRow label={COPY.mode}><ValkeyModeLabel mode={valkey.mode} /></SummaryRow>
	<SummaryRow label={COPY.size}>
		<span class="tabular-nums">{formatMegabytes(valkey.maxmemory_mb)}</span>
	</SummaryRow>
	<SummaryRow label={COPY.region} mono={Boolean(valkey.region)}>
		{valkey.region ?? COPY.autoRegion}
	</SummaryRow>
	<SummaryRow label={COPY.projects} testid="valkey-summary-projects">
		<span class="tabular-nums">{countFormat.format(valkey.projects.length)}</span>
	</SummaryRow>
	{#if valkey.created_at}
		<SummaryRow label={COPY.created}>{formatDate(valkey.created_at)}</SummaryRow>
	{/if}
	{#snippet footer()}
		{#if mode.summary}
			<LearnMore topic={COPY.learnMode(mode.label)} testid="valkey-mode-explanation">
				<p>{mode.summary} {mode.whenFull}</p>
			</LearnMore>
		{/if}
	{/snippet}
</PanelSummary>

<PanelNextSteps {steps} testid="valkey-next-steps" />

<PanelHelp testid="valkey-help">
	<ValkeyUsageHelp mode={valkey.mode} />
</PanelHelp>

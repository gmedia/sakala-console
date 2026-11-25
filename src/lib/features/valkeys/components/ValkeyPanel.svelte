<script lang="ts">
	import type { Valkey } from '$lib/api/resources/valkeys';
	import PanelHelp from '$lib/components/panel/PanelHelp.svelte';
	import PanelNextSteps from '$lib/components/panel/PanelNextSteps.svelte';
	import LearnMore from '$lib/components/ui/LearnMore.svelte';
	import { deriveValkeySteps, VALKEY_PANEL_COPY as COPY } from '../panel';
	import { valkeyModeView } from '../presentation';
	import ValkeyUsageHelp from './ValkeyUsageHelp.svelte';

	/** Next steps and guides only: the store's facts sit under its name, like a project's header. */
	type Props = { valkey: Valkey; canManage: boolean };

	let { valkey, canManage }: Props = $props();

	const mode = $derived(valkeyModeView(valkey.mode));
	const steps = $derived(deriveValkeySteps(valkey, canManage));
</script>

<PanelNextSteps {steps} testid="valkey-next-steps" />

<PanelHelp testid="valkey-help">
	{#if mode.summary}
		<LearnMore
			topic={COPY.learnMode(mode.label)}
			label={COPY.modeHelp(mode.label)}
			testid="valkey-mode-explanation"
		>
			<p>{mode.summary} {mode.whenFull}</p>
		</LearnMore>
	{/if}
	<ValkeyUsageHelp mode={valkey.mode} />
</PanelHelp>

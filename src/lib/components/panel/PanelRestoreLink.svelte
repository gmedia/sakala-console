<script lang="ts">
	import { tick } from 'svelte';
	import { PANEL_COPY, PANEL_IDS } from './panel';

	/** Shown only while steps that apply are hidden; brings them all back. */
	let { onRestore }: { onRestore: () => void } = $props();

	// The link goes away with nothing left hidden, so focus moves to the steps it brought back.
	async function restore() {
		onRestore();
		await tick();
		document.getElementById(PANEL_IDS.nextHeading)?.focus();
	}
</script>

<button
	id={PANEL_IDS.restore}
	type="button"
	class="inline-flex min-h-6 cursor-pointer items-center self-start text-left text-xs text-muted underline underline-offset-2 hover:text-foreground"
	data-testid="panel-restore-steps"
	onclick={restore}
>
	{PANEL_COPY.restoreSteps}
</button>

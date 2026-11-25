<script lang="ts">
	import type { Snippet } from 'svelte';
	import PanelCard from './PanelCard.svelte';
	import { PANEL_COPY } from './panel';

	type Props = {
		/** `SummaryRow`s: facts as values and badges, never sentences. */
		children: Snippet;
		/** Anything under the facts, such as one "Pelajari". */
		footer?: Snippet;
		testid?: string;
	};

	let { children, footer, testid = 'panel-summary' }: Props = $props();
</script>

<PanelCard title={PANEL_COPY.summary} {testid}>
	<dl class="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-4 gap-y-2 text-sm">
		{@render children()}
	</dl>
	{@render footer?.()}
</PanelCard>

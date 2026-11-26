<script lang="ts">
	import PanelNextSteps from './PanelNextSteps.svelte';
	import type { PanelStep } from './panel';

	let { steps }: { steps: PanelStep[] } = $props();

	// What a page does with the panel's callbacks: keep the hidden ids and filter by them.
	let hidden = $state<string[]>([]);
	const visible = $derived(steps.filter((step) => !hidden.includes(step.id)));
</script>

<PanelNextSteps
	steps={visible}
	onDismiss={(id) => (hidden = [...hidden, id])}
	hiddenCount={hidden.length}
	onRestore={() => (hidden = [])}
/>

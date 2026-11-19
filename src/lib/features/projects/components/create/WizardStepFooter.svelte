<script lang="ts">
	import type { Snippet } from 'svelte';
	import CancelCreateProjectAction from './CancelCreateProjectAction.svelte';

	/**
	 * The step's actions, with Batal beside them. From 640 px it sticks to the bottom of the scroll
	 * area, so the primary action stays in reach after a long repository list. Below that it stays
	 * at the end of the step: three stacked buttons would cover a quarter of a phone screen.
	 */
	let { children }: { children: Snippet } = $props();
</script>

<div
	class="-mx-2 mt-2 flex flex-col-reverse gap-2 border-t border-border bg-background px-2 py-3 sm:sticky sm:bottom-0 sm:z-10 sm:flex-row sm:items-center sm:justify-between"
	data-testid="wizard-step-footer"
	data-sticky-step-footer
>
	<CancelCreateProjectAction />
	<div class="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
		{@render children()}
	</div>
</div>

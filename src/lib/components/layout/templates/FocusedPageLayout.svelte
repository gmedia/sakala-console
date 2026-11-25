<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		/** One task: a wizard step, a create form, a sign-in. */
		children: Snippet;
	};

	let { children }: Props = $props();
</script>

<!--
	Focused task template (docs/UI_GUIDELINES.md): one centered column at reading width, nothing
	beside it, so the only way forward is the task's own primary action.
-->
<div class="mx-auto flex w-full max-w-reading min-w-0 flex-col gap-4" data-testid="focused-page">
	{@render children()}
</div>

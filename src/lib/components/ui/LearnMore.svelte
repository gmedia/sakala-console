<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		/** What the details explain, read after the label so each one has its own name. */
		topic: string;
		/** "Pelajari" by default; a how-to list can name its subject instead ("Laravel"). */
		label?: string;
		children: Snippet;
		testid?: string;
	};

	let { topic, label = 'Pelajari', children, testid }: Props = $props();
</script>

<!-- Explanations a person rarely needs stay folded, so the form shows fields, not paragraphs. -->
<details class="text-sm" data-testid={testid}>
	<summary
		class="inline-flex min-h-6 cursor-pointer items-center font-medium text-primary-dark underline underline-offset-2"
	>
		{label}{#if topic !== label}<span class="sr-only">&nbsp;{topic}</span>{/if}
	</summary>
	<div class="mt-2 flex flex-col gap-2 text-foreground/80">
		{@render children()}
	</div>
</details>

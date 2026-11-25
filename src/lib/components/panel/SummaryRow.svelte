<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';

	type Props = {
		label: string;
		children: Snippet;
		/** For code-like values: names, branches, addresses, ports. */
		mono?: boolean;
		testid?: string;
	};

	let { label, children, mono = false, testid }: Props = $props();
</script>

<!-- `contents` keeps term and value as cells of the summary's two-column grid. -->
<div class="contents">
	<dt class="text-muted">{label}</dt>
	<dd
		class={cn(
			'flex min-w-0 flex-wrap items-center gap-1.5 wrap-anywhere text-foreground',
			mono && 'font-mono'
		)}
		data-testid={testid}
	>
		{@render children()}
	</dd>
</div>

<script lang="ts">
	type logVariant = 'default' | 'highlight';

	type LogLine = {
		timestamp: string;
		message: string;
		variant?: logVariant;
	};

	type Props = {
		lines: readonly LogLine[];
		autoScroll?: boolean;
	};

	let { lines, autoScroll = true }: Props = $props();

	let scrollContainer: HTMLDivElement;

	const variantColorMap: Record<logVariant, string> = {
		default: 'text-terminal-text',
		highlight: 'text-warning'
	};

	const timestampColorMap: Record<logVariant, string> = {
		default: 'text-muted',
		highlight: 'text-warning'
	};

	$effect(() => {
		if (!autoScroll || !scrollContainer) return;
		scrollContainer.scrollTop = scrollContainer.scrollHeight;
	});
</script>

<div
	bind:this={scrollContainer}
	class="max-h-80 overflow-y-auto rounded-lg bg-terminal p-4 font-mono text-sm leading-relaxed"
>
	{#each lines as line, i (i)}
		{@const variant = line.variant ?? 'default'}
		<div class="whitespace-pre-wrap">
			<span class={timestampColorMap[variant]}>[{line.timestamp}]</span>
			<span class={variantColorMap['default']}>{line.message}</span>
		</div>
	{/each}
</div>

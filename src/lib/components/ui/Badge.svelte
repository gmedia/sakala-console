<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';

	type Props = {
		children: Snippet;
		tone?: 'neutral' | 'success' | 'warning' | 'info';
		class?: string;
	};

	let { children, tone = 'neutral', class: className = '' }: Props = $props();

	const tones = {
		neutral: 'border-border bg-background-soft text-muted',
		success: 'border-success/20 bg-success/10 text-success',
		warning: 'border-warning/20 bg-accent-soft text-warning',
		info: 'border-info/20 bg-info/10 text-info'
	};
</script>

<span
	class={cn(
		'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
		tones[tone],
		className
	)}
>
	{@render children()}
</span>

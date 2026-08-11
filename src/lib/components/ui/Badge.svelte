<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';

	type Props = {
		children: Snippet;
		tone?: 'neutral' | 'success' | 'success1' | 'warning' | 'error' | 'info' | 'muted';
		class?: string;
	};

	let { children, tone = 'success', class: className = '' }: Props = $props();

	const tones = {
		neutral: 'border-border bg-background-soft text-muted',
		success: 'border-success/20 bg-success/10 text-success',
		success1: 'border-[#0F766E] bg-[#E7F1F1] text-[#0F766E]',
		warning: 'border-warning/20 bg-accent-soft text-warning',
		error: 'border-error/20 bg-error/10 text-error',
		info: 'border-info/20 bg-info/10 text-info',
		muted: 'border-muted/20 bg-muted/10 text-muted'
	};
</script>

<span
	class={cn(
		'inline-flex items-center gap-1 leading-none rounded-full border px-2 py-1 text-xs font-normal capitalize',
		tones[tone],
		className
	)}
>
	<span class="w-2 h-2 rounded-full bg-current"></span>
	{@render children()}
</span>

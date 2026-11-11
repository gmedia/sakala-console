<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';

	export type BadgeTone =
		'neutral' | 'success' | 'warning' | 'error' | 'info' | 'muted' | 'running' | 'queued';

	type Props = {
		children: Snippet;
		tone?: BadgeTone;
		class?: string;
	};

	let { children, tone = 'success', class: className = '' }: Props = $props();

	const tones: Record<BadgeTone, string> = {
		neutral: 'border-border bg-background-soft text-foreground',
		success: 'border-success/20 bg-success/10 text-success',
		warning: 'border-warning/20 bg-accent-soft text-warning',
		error: 'border-error/20 bg-error/10 text-error',
		info: 'border-info/20 bg-info/10 text-info',
		muted: 'border-border bg-muted/10 text-foreground',
		running: 'border-primary/20 bg-primary-50 text-primary-dark',
		queued: 'border-queued/40 bg-queued-soft text-queued-ink'
	};

	const dots: Partial<Record<BadgeTone, string>> = { queued: 'bg-queued' };
</script>

<span
	class={cn(
		'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
		tones[tone],
		className
	)}
>
	<span class={cn('size-2 shrink-0 rounded-full', dots[tone] ?? 'bg-current')} aria-hidden="true"
	></span>
	{@render children()}
</span>

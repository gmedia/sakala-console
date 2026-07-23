<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';
	import type { ProjectStatus } from '$lib/types/project';

	type Props = {
		children: Snippet;
		tone?: ProjectStatus;
		class?: string;
	};

	let { children, tone = 'success', class: className = '' }: Props = $props();

	const tones = {
		success: 'border-success/20 bg-success/10 text-success',
		failed: 'border-error/20 bg-error/10 text-error',
		pending: 'border-warning/20 bg-accent-soft text-warning'
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

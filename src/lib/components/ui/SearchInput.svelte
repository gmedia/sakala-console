<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';

	type Props = {
		value?: string;
		placeholder?: string;
		onSearch?: (value: string) => void;
		icon?: Snippet;
		disabled?: boolean;
		class?: string;
	};

	let {
		value = $bindable(''),
		placeholder = 'Search...',
		onSearch,
		disabled = false,
		icon,
		class: className = ''
	}: Props = $props();

	function handleInput() {
		onSearch?.(value);
	}
</script>

<div
	class={cn(
		'flex items-center rounded-lg bg-white px-3 py-0.5',
		disabled && 'opacity-50',
		className
	)}
>
	{#if icon}
		{@render icon()}
	{/if}
	<input
		type="text"
		bind:value
		oninput={handleInput}
		{placeholder}
		{disabled}
		class="flex-1 bg-transparent text-sm border-none text-muted focus:ring-0"
	/>
</div>

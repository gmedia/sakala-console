<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';

	type Props = {
		value?: string;
		placeholder?: string;
		onSearch?: (value: string) => void;
		icon?: Snippet;
		disabled?: boolean;
		debounce?: number;
		id?: string;
		class?: string;
	};

	let {
		value = $bindable(''),
		placeholder = 'Cari...',
		onSearch,
		icon,
		disabled = false,
		debounce = 0,
		id,
		class: className = ''
	}: Props = $props();

	let debounceTimer: ReturnType<typeof setTimeout>;

	function handleInput() {
		if (!debounce) {
			onSearch?.(value);
			return;
		}
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			onSearch?.(value);
		}, debounce);
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
		aria-label={placeholder}
		{id}
		class="flex-1 bg-transparent text-sm border-none focus:ring-0"
	/>
</div>

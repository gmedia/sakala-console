<script lang="ts">
	import MagnifyingGlass from 'phosphor-svelte/lib/MagnifyingGlass';
	import { cn } from '$lib/utils/cn';

	type Props = {
		value?: string;
		placeholder?: string;
		onSearch?: (value: string) => void;
		disabled?: boolean;
		debounce?: number;
		id?: string;
		class?: string;
	};

	let {
		value = $bindable(''),
		placeholder = 'Cari...',
		onSearch,
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
		'flex min-h-control-lg items-center gap-2 rounded-control border border-border-strong bg-surface px-3 focus-within:border-primary focus-within:outline-3 focus-within:outline-offset-1 focus-within:outline-primary',
		disabled && 'opacity-50',
		className
	)}
>
	<MagnifyingGlass size={18} class="shrink-0 text-muted" aria-hidden="true" />
	<input
		type="text"
		bind:value
		oninput={handleInput}
		{placeholder}
		{disabled}
		aria-label={placeholder}
		{id}
		class="search-input min-h-control-md min-w-0 flex-1 border-none bg-transparent p-0 text-sm placeholder:text-muted"
	/>
</div>

<style>
	/* The box around this input shows the focus. */
	.search-input:focus {
		outline: none;
		box-shadow: none;
	}
</style>

<script lang="ts">
	import Search from '@lucide/svelte/icons/search';
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
		'flex items-center rounded-lg border border-border-strong bg-surface px-3 py-0.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary',
		disabled && 'opacity-50',
		className
	)}
>
	<Search class="h-5 w-5 text-muted" />
	<input
		type="text"
		bind:value
		oninput={handleInput}
		{placeholder}
		{disabled}
		aria-label={placeholder}
		{id}
		class="min-w-0 flex-1 bg-transparent placeholder:text-muted placeholder:font-montserrat text-sm border-none ps-1 focus:ring-0 focus:outline-none"
	/>
</div>

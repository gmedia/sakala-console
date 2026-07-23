<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';

	type Variants = 'primary' | 'secondary' | 'ghost' | 'outline';

	type Options<T> = {
		label: string;
		value: T;
		disabled?: boolean;
	};

	type Props<T> = {
		options: Options<T>[];
		value?: T;
		placeholder?: string;
		icon?: Snippet;
		variant?: Variants;
		class?: string;
		contentClass?: string;
		renderOption?: Snippet<[Options<T>]>;
	};

	let {
		options,
		value = $bindable(),
		placeholder,
		icon,
		variant = 'primary',
		class: className = '',
		contentClass,
		renderOption
	}: Props<T> = $props();

	let open = $state(false);

	const variants: Record<Variants, string> = {
		primary: 'bg-primary/10 text-primary',
		secondary:
			'border-border-strong bg-surface text-foreground hover:border-primary hover:text-primary',
		ghost:
			'border-transparent bg-transparent text-muted hover:bg-background-soft hover:text-foreground',
		outline: 'border border-black bg-transparent text-foreground'
	};

	const classes = $derived(
		cn(
			'inline-flex min-h-8 items-center justify-center font-montserrat gap-2 rounded-xl px-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
			variants[variant],
			className
		)
	);

	const selectedLabel = $derived(options.find((opt) => opt.value === value)?.label);

	function toogle() {
		open = !open;
	}

	function selectOption(option: Options<T>) {
		if (option.disabled) return;
		value = option.value;
		open = false;
	}
</script>

<div class="relative inline-block">
	<button
		type="button"
		class={classes}
		aria-haspopup="listbox"
		aria-expanded={open}
		onclick={toogle}
	>
		{#if icon}
			{@render icon()}
		{/if}

		<span class="flex-1 text-left w-auto">
			{#if selectedLabel}
				{selectedLabel}
			{:else}
				<span class="text-muted">{placeholder}</span>
			{/if}
		</span>
	</button>

	{#if open}
		<ul
			role="listbox"
			class={cn(
				'absolute z-10 mt-1 min-w-full overflow-hidden rounded-lg border border-border-strong bg-surface py-1 shadow-md',
				contentClass
			)}
		>
			{#each options as opt (opt.value)}
				<li role="option" aria-selected={opt.value === value}>
					<button
						type="button"
						disabled={opt.disabled}
						class={cn(
							'w-full cursor-pointer px-3 py-2 text-left text-sm hover:bg-background-soft',
							opt.value === value && 'font-semibold text-primary',
							opt.disabled && 'cursor-not-allowed opacity-50 hover:bg-transparent'
						)}
						onclick={() => selectOption(opt)}
					>
						{#if renderOption}
							{@render renderOption(opt)}
						{:else}
							{opt.label}
						{/if}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<script lang="ts" generics="T">
	import type { Snippet, Component } from 'svelte';
	import { onMount } from 'svelte';
	import { cn } from '$lib/utils/cn';

	type Variants = 'primary' | 'secondary' | 'ghost' | 'outline';
	type IconPosition = 'start' | 'end';

	type Options<T> = {
		label: string;
		value: T;
		disabled?: boolean;
	};

	type Props<T> = {
		options: Options<T>[];
		value?: T;
		placeholder?: string;
		subtitle?: string;
		icon?: Snippet<[boolean]>;
		iconPosition?: IconPosition;
		variant?: Variants;
		class?: string;
		contentClass?: string;
		labelClass?: string;
		selectedIcon?: Component;
		selectedLabelClass?: string;
		renderOption?: Snippet<[Options<T>]>;
		onblur?: () => void;
	};

	let {
		options,
		value = $bindable(),
		placeholder,
		subtitle,
		icon,
		iconPosition = 'start',
		variant = 'primary',
		class: className = '',
		contentClass,
		labelClass,
		selectedIcon,
		selectedLabelClass,
		renderOption,
		onblur
	}: Props<T> = $props();

	let open = $state(false);
	let dropdownContainer: HTMLDivElement | null = null;

	const variants: Record<Variants, string> = {
		primary: 'bg-primary-50 text-primary border border-primar-100 rounded-full',
		secondary:
			'border-border-strong bg-surface text-foreground hover:border-primary hover:text-primary',
		ghost:
			'border-transparent bg-transparent text-muted hover:bg-background-soft hover:text-foreground',
		outline: 'border border-black bg-transparent text-foreground'
	};

	const classes = $derived(
		cn(
			'inline-flex min-h-8 items-center justify-center cursor-pointer gap-2 rounded-xl px-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
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

	function handleClickOutside(event: MouseEvent) {
		if (open && dropdownContainer && !dropdownContainer.contains(event.target as Node)) {
			open = false;
		}
	}

	function handleFocusOut(event: FocusEvent) {
		const nextFocusTarget = event.relatedTarget as Node | null;
		if (dropdownContainer && nextFocusTarget && dropdownContainer.contains(nextFocusTarget)) {
			return;
		}
		onblur?.();
	}

	onMount(() => {
		document.addEventListener('click', handleClickOutside);

		return () => {
			document.removeEventListener('click', handleClickOutside);
		};
	});
</script>

<div bind:this={dropdownContainer} class="relative w-auto min-w-0" onfocusout={handleFocusOut}>
	<button
		type="button"
		class={classes}
		aria-haspopup="listbox"
		aria-expanded={open}
		onclick={toogle}
	>
		{#if icon && iconPosition === 'start'}
			{@render icon(open)}
		{/if}

		<span class="flex-1 text-left truncate">
			{#if selectedLabel}
				{selectedLabel}
			{:else}
				<span class="text-muted">{placeholder}</span>
			{/if}
		</span>

		{#if icon && iconPosition === 'end'}
			{@render icon(open)}
		{/if}
	</button>

	{#if open}
		<ul
			role="listbox"
			class={cn(
				'absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-border-strong bg-surface py-1 shadow-md',
				contentClass
			)}
		>
			{#if subtitle}
				<li class=" py-2 text-sm font-medium text-muted" aria-hidden="true">
					{subtitle}
				</li>
			{/if}
			{#each options as opt (opt.value)}
				<li role="option" aria-selected={opt.value === value}>
					<button
						type="button"
						disabled={opt.disabled}
						class={cn(
							'w-full flex justify-between items-end cursor-pointer px-3 py-2 text-left text-sm',
							labelClass,
							opt.value === value && selectedLabelClass,
							opt.disabled && 'cursor-not-allowed opacity-50 hover:bg-transparent'
						)}
						onclick={() => selectOption(opt)}
					>
						<span class="truncate">
							{#if renderOption}
								{@render renderOption(opt)}
							{:else}
								{opt.label}
							{/if}
						</span>

						{#if opt.value === value && selectedIcon}
							{@const Icon = selectedIcon}
							<Icon class="h-4 w-4 shrink-0 text-primary" />
						{/if}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

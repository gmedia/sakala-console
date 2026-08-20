<script lang="ts">
	import { List, CaretDown } from 'phosphor-svelte';
	import { cn } from '$lib/utils/cn';
	import type { DateFilterValue } from '$lib/features/projects/filters';

	type Props = {
		value: DateFilterValue;
	};

	let { value = $bindable() }: Props = $props();

	let open = $state(false);
	let containerRef: HTMLDivElement | null = $state(null);

	const dateOptions: { label: string; value: DateFilterValue }[] = [
		{ label: '7 hari terakhir', value: '7d' },
		{ label: '30 hari terakhir', value: '30d' },
		{ label: '90 hari terakhir', value: '90d' },
		{ label: 'Semua waktu', value: 'all' }
	];

	const selectedLabel = $derived(
		dateOptions.find((opt) => opt.value === value)?.label ?? '30 hari terakhir'
	);

	function toggle() {
		open = !open;
	}

	function selectOption(optValue: DateFilterValue) {
		value = optValue;
		open = false;
	}

	function handleWindowClick(e: MouseEvent) {
		if (open && containerRef && !containerRef.contains(e.target as Node)) {
			open = false;
		}
	}
</script>

<svelte:window onclick={handleWindowClick} />

<div bind:this={containerRef} class="relative inline-block">
	<!-- Trigger Button (w-43.75 / 175px, h-8 / 32px, rounded-2xl, gap-2 / 8px) -->
	<button
		type="button"
		class="flex h-8 w-43.75 items-center justify-between gap-2 rounded-2xl border border-primary bg-primary/10 px-3 font-sans text-xs font-semibold text-primary transition-colors hover:bg-primary/15"
		aria-haspopup="listbox"
		aria-expanded={open}
		onclick={toggle}
	>
		<List size={16} class="size-4 shrink-0 text-primary" />
		<span class="truncate font-sans text-xs font-semibold">{selectedLabel}</span>
		<CaretDown size={16} class="size-4 shrink-0 text-primary" />
	</button>

	<!-- Dropdown Popover (w-56.25 / 225px, h-45.75 / 183px, rounded-2xl, p-4) -->
	{#if open}
		<div
			role="listbox"
			class="absolute top-full left-0 z-50 mt-2 flex h-45.75 w-56.25 flex-col rounded-2xl border border-border bg-surface p-4 shadow-lg"
		>
			<span class="mb-2 font-sans text-[11px] font-semibold uppercase tracking-wider text-muted">
				FILTER BERDASARKAN WAKTU
			</span>

			<div class="flex flex-col gap-1">
				{#each dateOptions as opt (opt.value)}
					<button
						type="button"
						role="option"
						aria-selected={opt.value === value}
						class={cn(
							'flex h-8 w-48.25 items-center rounded-2xl px-3 font-sans text-xs transition-colors',
							opt.value === value
								? 'border border-primary bg-primary/10 font-semibold text-primary'
								: 'font-medium text-foreground hover:bg-background-soft'
						)}
						onclick={() => selectOption(opt.value)}
					>
						{opt.label}
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>

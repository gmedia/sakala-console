<script lang="ts">
	import { Select } from 'bits-ui';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';
	import Check from 'phosphor-svelte/lib/Check';
	import { buttonClasses } from '$lib/components/ui/button-classes';
	import type { DateFilterValue } from '$lib/features/projects/filters';

	type Props = {
		value: DateFilterValue;
	};

	let { value = $bindable() }: Props = $props();

	// The API filters on the date a project was created, and the label says so.
	const dateOptions: { label: string; value: DateFilterValue }[] = [
		{ label: 'Dibuat kapan saja', value: 'all' },
		{ label: 'Dibuat 7 hari terakhir', value: '7_days' },
		{ label: 'Dibuat 30 hari terakhir', value: '30_days' },
		{ label: 'Dibuat 90 hari terakhir', value: '90_days' }
	];

	const selectedLabel = $derived(
		dateOptions.find((option) => option.value === value)?.label ?? dateOptions[0].label
	);
</script>

<Select.Root type="single" bind:value={() => value, (next) => (value = next as DateFilterValue)}>
	<Select.Trigger
		aria-label={`Filter waktu: ${selectedLabel}`}
		class={buttonClasses('secondary', 'sm', 'w-full justify-between sm:w-auto')}
	>
		{selectedLabel}
		<CaretDown size={16} aria-hidden="true" />
	</Select.Trigger>
	<Select.Portal>
		<Select.Content
			sideOffset={4}
			class="z-50 min-w-(--bits-select-anchor-width) rounded-overlay border border-border bg-surface p-1 shadow-overlay"
		>
			<Select.Viewport>
				{#each dateOptions as option (option.value)}
					<Select.Item
						value={option.value}
						label={option.label}
						class="flex min-h-control-md cursor-pointer items-center justify-between gap-3 rounded-control px-3 text-sm data-highlighted:bg-background-soft"
					>
						{#snippet children({ selected })}
							{option.label}
							{#if selected}
								<Check size={16} class="shrink-0 text-primary-dark" aria-label="Terpilih" />
							{/if}
						{/snippet}
					</Select.Item>
				{/each}
			</Select.Viewport>
		</Select.Content>
	</Select.Portal>
</Select.Root>

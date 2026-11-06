<script lang="ts" generics="T extends string = DateFilterValue">
	import { Select } from 'bits-ui';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';
	import Check from 'phosphor-svelte/lib/Check';
	import { buttonClasses } from '$lib/components/ui/button-classes';
	import type { DateFilterValue } from '$lib/features/projects/filters';

	type Props = {
		value: T;
		options?: { label: string; value: T }[];
		name?: string;
	};

	// The API filters projects on the date they were created, and the label says so.
	const projectDateOptions = [
		{ label: 'Dibuat kapan saja', value: 'all' },
		{ label: 'Dibuat 7 hari terakhir', value: '7_days' },
		{ label: 'Dibuat 30 hari terakhir', value: '30_days' },
		{ label: 'Dibuat 90 hari terakhir', value: '90_days' }
	] as { label: string; value: T }[];

	let {
		value = $bindable(),
		options = projectDateOptions,
		name = 'Filter waktu'
	}: Props = $props();

	const selectedLabel = $derived(
		options.find((option) => option.value === value)?.label ?? options[0].label
	);
</script>

<Select.Root type="single" bind:value={() => value, (next) => (value = next as T)}>
	<Select.Trigger
		aria-label={`${name}: ${selectedLabel}`}
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
				{#each options as option (option.value)}
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

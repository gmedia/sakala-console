<script lang="ts">
	import Select from '$lib/components/ui/Select.svelte';
	import type { DateFilterValue } from '$lib/features/projects/filters';

	type Props = {
		value: DateFilterValue;
	};

	let { value = $bindable() }: Props = $props();

	const dateOptions: { label: string; value: DateFilterValue }[] = [
		{ label: '7 hari terakhir', value: '7d' },
		{ label: '30 hari terakhir', value: '30d' },
		{ label: 'Semua', value: 'all' }
	];
</script>

<Select
	options={dateOptions}
	bind:value
	variant="primary"
	class="w-auto min-w-30 px-3 hover:cursor-pointer"
	placeholder="Filter berdasarkan tanggal"
>
	{#snippet icon()}
		<img src="/icons/burger.svg" class="w-4 h-4" alt="burger" />
	{/snippet}
</Select>

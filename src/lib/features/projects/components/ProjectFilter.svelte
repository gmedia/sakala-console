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
	class="w-40 xs:w-40 sm:w-46 px-3 xs:px-4 py-2 cursor-pointer text-sm sm:text-base"
	placeholder="Filter berdasarkan tanggal"
>
	{#snippet icon()}
		<img src="/icons/burger.svg" class="w-4 h-4" alt="burger" />
	{/snippet}
</Select>

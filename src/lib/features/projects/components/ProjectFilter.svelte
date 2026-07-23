<script lang="ts">
	import Select from '$lib/components/ui/Select.svelte';

	type DateFilterValue = '7d' | '30d' | 'all';

	let dateFilter: DateFilterValue = $state('30d');

	const dateOptions: { label: string; value: DateFilterValue }[] = [
		{ label: '7 hari', value: '7d' },
		{ label: '30 hari', value: '30d' },
		{ label: 'Semua', value: 'all' }
	];
</script>

<Select
	options={dateOptions}
	bind:value={dateFilter}
	variant="primary"
	class="w-max px-3 hover:cursor-pointer"
	placeholder="Filter berdasarkan tanggal"
>
	{#snippet icon()}
		<img src="/icons/burger.svg" class="w-3 h-3" alt="menu" />
	{/snippet}
</Select>

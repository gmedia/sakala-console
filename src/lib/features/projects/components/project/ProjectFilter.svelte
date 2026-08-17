<script lang="ts">
	import { Menu, Check } from '@lucide/svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import type { DateFilterValue } from '$lib/features/projects/filters';

	type Props = {
		value: DateFilterValue;
	};

	let { value = $bindable() }: Props = $props();

	const dateOptions: { label: string; value: DateFilterValue }[] = [
		{ label: '7 hari terakhir', value: '7d' },
		{ label: '30 hari terakhir', value: '30d' },
		{ label: '90 hari terakhir', value: '90d' },
		{ label: 'Semua Waktu', value: 'all' }
	];
</script>

<Select
	options={dateOptions}
	bind:value
	iconPosition="start"
	variant="primary"
	class="w-40 xs:w-40 sm:w-46 px-3 xs:px-4 py-2 text-sm sm:text-base font-montserrat-semibold"
	placeholder="Filter berdasarkan tanggal"
	subtitle="FILTER BERDASARKAN WAKTU"
	labelClass="font-montserrat-medium"
	contentClass="w-64 p-4"
	selectedLabelClass="bg-primary-50 text-primary rounded-full border border-primary/50"
	selectedIcon={Check}
>
	{#snippet icon()}
		<Menu class="h-5 w-5" />
	{/snippet}
</Select>

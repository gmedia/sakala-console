<script lang="ts">
	import Bell from 'phosphor-svelte/lib/Bell';
	import EmptyState from '$lib/components/feedback/EmptyState.svelte';

	type Props = {
		title?: string;
		description?: string;
	};

	let {
		title = 'Tidak ada notifikasi',
		description = 'Kabar deployment dan akunmu muncul di sini.'
	}: Props = $props();
</script>

<EmptyState
	icon={Bell}
	tone="muted"
	{title}
	{description}
	class="border-none bg-transparent py-6 sm:py-6"
/>

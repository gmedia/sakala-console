<script lang="ts">
	import { EmptyIcon } from 'phosphor-svelte';
	import Button from '../ui/Button.svelte';

	let {
		title = 'Terjadi kesalahan',
		description = 'Gagal memuat data. Silakan periksa koneksi anda dan coba lagi.',
		onRetry
	}: {
		title?: string;
		description?: string;
		onRetry?: () => void;
	} = $props();
</script>

<div
	class="flex flex-col items-center justify-center p-8 text-center bg-red-50/50 border border-red-100 rounded-xl max-w-md w-full mx-auto"
	role="alert"
	aria-live="assertive"
>
	<EmptyIcon size={48} aria-hidden="true" class="text-error-base" />
	<h2 class="text-base font-montserrat-semibold">{title}</h2>
	{#if description}
		<p class="mt-2 text-sm font-montserrat-medium">{description}</p>
	{/if}

	{#if onRetry}
		<Button class="mt-4" variant="primary" onclick={onRetry}>Coba Lagi</Button>
	{/if}
</div>

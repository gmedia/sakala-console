<script lang="ts">
	import { LoaderCircle, Server, WifiOff } from '@lucide/svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import { createServiceStatusQuery } from '../queries';

	const statusQuery = createServiceStatusQuery();
</script>

<Card class="h-full">
	<div class="flex items-start justify-between gap-4" aria-live="polite">
		<div>
			<p class="text-sm font-medium text-muted">Sakala API</p>

			{#if statusQuery.isPending}
				<p class="mt-5 text-lg font-semibold">Memeriksa koneksi...</p>
				<p class="mt-1 text-sm leading-6 text-muted">Menghubungi control plane Sakala.</p>
			{:else if statusQuery.isError}
				<p class="mt-5 text-lg font-semibold">Belum terhubung</p>
				<p class="mt-1 text-sm leading-6 text-muted">
					Jalankan sakala-api dan periksa PUBLIC_API_URL untuk mencoba lagi.
				</p>
			{:else}
				<p class="mt-5 text-lg font-semibold text-success">API tersambung</p>
				<p class="mt-1 text-sm leading-6 text-muted">
					{statusQuery.data.service} · {statusQuery.data.api_version}
				</p>
			{/if}
		</div>

		{#if statusQuery.isPending}
			<LoaderCircle class="animate-spin text-primary" size={20} aria-hidden="true" />
		{:else if statusQuery.isError}
			<WifiOff class="text-error" size={20} aria-hidden="true" />
		{:else}
			<Server class="text-success" size={20} aria-hidden="true" />
		{/if}
	</div>
</Card>

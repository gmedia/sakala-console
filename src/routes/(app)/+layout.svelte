<script lang="ts">
	import AppShell from '$lib/components/layout/AppShell.svelte';
	import { useCurrentUser } from '$lib/features/auth/queries';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';
	import { ApiError, NetworkError } from '$lib/api/errors';
	import ErrorBlock from '$lib/components/feedback/ErrorBlock.svelte';
	import LoadingSkeleton from '$lib/components/feedback/LoadingSkeleton.svelte';

	let { children } = $props();

	const currentUser = useCurrentUser();

	$effect(() => {
		if (currentUser.isError) {
			const err = currentUser.error;
			if (err instanceof ApiError && err.isUnauthenticated) {
				const returnTo = encodeURIComponent($page.url.pathname + $page.url.search);
				goto(resolve(`/login?returnTo=${returnTo}`), { replaceState: true });
			}
		}
	});
</script>

{#if currentUser.isPending}
	<div class="flex min-h-screen items-center justify-center">
		<LoadingSkeleton />
	</div>
{:else if currentUser.isError}
	{#if currentUser.error instanceof ApiError && currentUser.error.isUnauthenticated}
		<div class="min-h-screen"></div>
	{:else}
		<div class="flex min-h-screen items-center justify-center p-4">
			<ErrorBlock
				title={currentUser.error instanceof NetworkError
					? 'Koneksi Terputus'
					: 'Sesi tidak tersedia'}
				description={currentUser.error.message || 'Gagal memuat data pengguna. Silakan coba lagi.'}
				onRetry={() => currentUser.refetch()}
			/>
		</div>
	{/if}
{:else if currentUser.isSuccess}
	<AppShell>
		{@render children()}
	</AppShell>
{/if}

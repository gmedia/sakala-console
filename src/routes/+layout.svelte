<script lang="ts">
	import '../app.css';
	import { QueryClientProvider } from '@tanstack/svelte-query';
	import favicon from '$lib/assets/favicon.svg';
	import { queryClient, setSessionExpiredHandler } from '$lib/api/query-client';
	import { handleSessionExpired } from '$lib/features/auth/session-expiry';

	let { children } = $props();

	setSessionExpiredHandler(handleSessionExpired);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Sakala Console</title>
	<meta
		name="description"
		content="Kelola proyek dan deployment Sakala: deploy dari repository, baca log, dan pantau statusnya."
	/>
</svelte:head>

<a
	href="#main-content"
	class="sr-only text-sm font-semibold focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-3 focus:text-white"
>
	Langsung ke konten utama
</a>

<QueryClientProvider client={queryClient}>
	{@render children()}
</QueryClientProvider>

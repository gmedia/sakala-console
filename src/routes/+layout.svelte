<script lang="ts">
	import '../app.css';
	import { QueryClientProvider } from '@tanstack/svelte-query';
	import { Toaster } from 'svelte-sonner';
	import favicon from '$lib/assets/favicon.svg';
	import { queryClient, setSessionExpiredHandler } from '$lib/api/query-client';
	import { handleSessionExpired } from '$lib/features/auth/session-expiry';

	let { children } = $props();

	setSessionExpiredHandler(handleSessionExpired);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Sakala</title>
	<meta
		name="description"
		content="Kelola proyek dan deployment Sakala: deploy dari repository, baca log, dan pantau statusnya."
	/>
</svelte:head>

<a
	href="#main-content"
	class="sr-only text-sm font-semibold focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-control focus:bg-primary focus:px-4 focus:py-3 focus:text-white"
>
	Langsung ke konten utama
</a>

<QueryClientProvider client={queryClient}>
	{@render children()}
</QueryClientProvider>

<!-- The one live region for toasts. A toast confirms what an action did when nothing else on the
     screen says so: a copy, a saved variable, a redeploy that opened another page. Errors that need
     a fix stay inline, next to the field or banner they belong to. -->
<Toaster position="bottom-right" containerAriaLabel="Notifikasi sementara" />

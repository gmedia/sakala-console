<script lang="ts">
	import '../app.css';
	import { QueryClientProvider } from '@tanstack/svelte-query';
	import favicon from '$lib/assets/favicon.svg';
	import { queryClient } from '$lib/api/query-client';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Sakala Console</title>
	<meta
		name="description"
		content="Kelola project dan deployment Sakala dari satu console yang jelas dan mudah dipahami."
	/>
</svelte:head>

<QueryClientProvider client={queryClient}>
	{@render children()}
</QueryClientProvider>

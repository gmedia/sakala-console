<script lang="ts">
	import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
	import type { Component } from 'svelte';

	type Props = {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		component: Component<any>;
		props?: Record<string, unknown>;
		client?: QueryClient;
	};

	let {
		component: Inner,
		props = {},
		client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	}: Props = $props();
</script>

<QueryClientProvider {client}>
	<Inner {...props} />
</QueryClientProvider>

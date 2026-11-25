<script lang="ts">
	import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
	import type { SettingsPage } from '$lib/features/projects/settings-anchors';
	import ProjectSettingsLayoutStub from './ProjectSettingsLayoutStub.svelte';

	let { projectId, page }: { projectId: string; page: SettingsPage } = $props();

	// Its own client, so `rerender({ page })` switches pages without the props-of-props wrapper.
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
</script>

<QueryClientProvider {client}>
	<ProjectSettingsLayoutStub {projectId} {page} />
</QueryClientProvider>

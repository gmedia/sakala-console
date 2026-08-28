<script lang="ts">
	import AppShell from '$lib/components/layout/AppShell.svelte';
	import AuthGuard from '$lib/features/auth/components/AuthGuard.svelte';

	let { children } = $props();
</script>

<AuthGuard>
	<AppShell>
		{@render children()}
	</AppShell>
</AuthGuard>

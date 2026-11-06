<script lang="ts">
	import AuthGuard from '$lib/features/auth/components/AuthGuard.svelte';

	let { children } = $props();
</script>

<AuthGuard>
	{@render children()}
</AuthGuard>

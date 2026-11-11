<script lang="ts">
	import AuthGuard from '$lib/features/auth/components/AuthGuard.svelte';
	import AdminGuard from '$lib/features/admin/components/AdminGuard.svelte';
	import AdminShell from '$lib/features/admin/components/AdminShell.svelte';

	let { children } = $props();
</script>

<AuthGuard>
	<AdminGuard>
		<AdminShell>
			{@render children()}
		</AdminShell>
	</AdminGuard>
</AuthGuard>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { useCurrentUser } from '$lib/features/auth/queries';
	import AdminForbidden from './AdminForbidden.svelte';
	import { isAdmin } from '../access';

	let { children }: { children: Snippet } = $props();

	// AuthGuard has already loaded the user. This only decides what to show; the API answers 403
	// to anyone but an admin whatever the console does.
	const currentUser = useCurrentUser();
</script>

{#if isAdmin(currentUser.data)}
	{@render children()}
{:else}
	<AdminForbidden />
{/if}

<script lang="ts">
	import { page } from '$app/state';
	import UserDetailPage from '$lib/features/admin/components/pages/UserDetailPage.svelte';
</script>

{#key page.params.id}
	<UserDetailPage id={page.params.id ?? ''} />
{/key}

<script lang="ts">
	import { pageTitle } from '$lib/utils/page-title';
	import MyInvitationsList from '$lib/features/workspaces/components/MyInvitationsList.svelte';
</script>

<svelte:head><title>{pageTitle('Undangan workspace')}</title></svelte:head>

<div class="max-w-reading pb-12">
	<MyInvitationsList />
</div>

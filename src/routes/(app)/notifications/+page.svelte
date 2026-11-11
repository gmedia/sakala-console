<script lang="ts">
	import { pageTitle } from '$lib/utils/page-title';
	import NotificationCenter from '$lib/features/notifications/components/NotificationCenter.svelte';
	import MyInvitationsList from '$lib/features/workspaces/components/MyInvitationsList.svelte';
</script>

<svelte:head>
	<title>{pageTitle('Notifikasi')}</title>
</svelte:head>

<div class="flex max-w-reading flex-col gap-6">
	<MyInvitationsList hideWhenEmpty />
	<NotificationCenter />
</div>

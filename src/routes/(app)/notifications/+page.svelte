<script lang="ts">
	import { pageTitle } from '$lib/utils/page-title';
	import NotificationCenter from '$lib/features/notifications/components/NotificationCenter.svelte';
</script>

<svelte:head>
	<title>{pageTitle('Notifikasi')}</title>
</svelte:head>

<NotificationCenter />

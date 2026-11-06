<script lang="ts">
	import { pageTitle } from '$lib/utils/page-title';
	import ProfilePanel from '$lib/features/profile/components/ProfilePanel.svelte';
</script>

<svelte:head>
	<title>{pageTitle('Profil saya')}</title>
</svelte:head>

<ProfilePanel />

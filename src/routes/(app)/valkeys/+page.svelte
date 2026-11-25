<script lang="ts">
	import { pageTitle } from '$lib/utils/page-title';
	import ValkeysPage from '$lib/features/valkeys/components/ValkeysPage.svelte';
</script>

<svelte:head><title>{pageTitle('Valkey')}</title></svelte:head>

<ValkeysPage />

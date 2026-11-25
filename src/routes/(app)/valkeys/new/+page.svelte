<script lang="ts">
	import { pageTitle } from '$lib/utils/page-title';
	import CreateValkeyPage from '$lib/features/valkeys/components/CreateValkeyPage.svelte';
</script>

<svelte:head><title>{pageTitle('Buat Valkey')}</title></svelte:head>

<CreateValkeyPage />

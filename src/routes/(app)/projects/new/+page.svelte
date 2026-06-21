<script lang="ts">
	import { Construction } from '@lucide/svelte';
	import EmptyState from '$lib/components/feedback/EmptyState.svelte';
</script>

<svelte:head><title>Project Baru | Sakala Console</title></svelte:head>

<EmptyState
	icon={Construction}
	title="Alur project sedang disiapkan"
	description="Form tidak dibuat palsu sebelum kontrak Project API tersedia. Halaman ini akan menjadi repository picker dan deployment setup yang transparan."
/>

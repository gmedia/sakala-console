<script lang="ts">
	import { Settings } from '@lucide/svelte';
	import EmptyState from '$lib/components/feedback/EmptyState.svelte';
</script>

<svelte:head><title>Settings | Sakala Console</title></svelte:head>

<EmptyState
	icon={Settings}
	title="Pengaturan menyusul setelah auth"
	description="Profil dan preferensi akan mengikuti kontrak user dari Sakala API, bukan disimpan sebagai business state di frontend."
/>

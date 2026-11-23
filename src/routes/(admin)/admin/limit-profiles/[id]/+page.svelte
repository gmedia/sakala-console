<script lang="ts">
	import { page } from '$app/state';
	import LimitProfileFormPage from '$lib/features/admin/components/pages/LimitProfileFormPage.svelte';
</script>

{#key page.params.id}
	<LimitProfileFormPage profileId={page.params.id ?? ''} />
{/key}

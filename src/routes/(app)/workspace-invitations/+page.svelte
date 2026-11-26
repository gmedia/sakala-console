<script lang="ts">
	import { pageTitle } from '$lib/utils/page-title';
	import FocusedPageLayout from '$lib/components/layout/templates/FocusedPageLayout.svelte';
	import MyInvitationsList from '$lib/features/workspaces/components/MyInvitationsList.svelte';
</script>

<svelte:head><title>{pageTitle('Undangan workspace')}</title></svelte:head>

<!-- One decision per invitation (accept or decline), so the focused template, centred. -->
<FocusedPageLayout>
	<MyInvitationsList />
</FocusedPageLayout>

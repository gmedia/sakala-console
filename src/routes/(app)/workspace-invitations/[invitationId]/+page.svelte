<script lang="ts">
	import { page } from '$app/state';
	import { pageTitle } from '$lib/utils/page-title';
	import FocusedPageLayout from '$lib/components/layout/templates/FocusedPageLayout.svelte';
	import InvitationLinkPage from '$lib/features/workspaces/components/InvitationLinkPage.svelte';

	// The email links here: `/workspace-invitations/{id}?token=...` (WorkspaceInvitationNotification).
	const invitationId = $derived(page.params.invitationId ?? '');
	const token = $derived(page.url.searchParams.get('token') ?? undefined);
</script>

<svelte:head><title>{pageTitle('Undangan workspace')}</title></svelte:head>

<!-- One decision (accept or decline), so the focused template, centred. -->
<FocusedPageLayout>
	{#key invitationId}
		<InvitationLinkPage {invitationId} {token} />
	{/key}
</FocusedPageLayout>

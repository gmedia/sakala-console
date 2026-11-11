<script lang="ts">
	import { resolve } from '$app/paths';
	import Button from '$lib/components/ui/Button.svelte';
	import { INVITATION_PROBLEM_COPY } from '../presentation';
	import { createMyInvitationsQuery } from '../queries';
	import InvitationCard from './InvitationCard.svelte';

	let { invitationId, token }: { invitationId: string; token?: string } = $props();

	// The API has no read for one invitation by token, so details come from the caller's own list,
	// which holds invitations for their verified email. A link sent to another address has none.
	const invitationsQuery = createMyInvitationsQuery();
	const invitation = $derived(
		invitationsQuery.data?.find((item) => item.id === invitationId) ?? null
	);
	const settled = $derived(invitationsQuery.isSuccess || invitationsQuery.isError);
	// Without the token only an invitation for the caller's email can be answered.
	const unreachable = $derived(settled && !token && !invitation);
</script>

{#if !settled}
	<div class="skeleton h-40 w-full" role="status" aria-label="Memuat undangan"></div>
{:else if unreachable}
	<div
		role="alert"
		class="surface-card flex flex-col gap-3 p-4 sm:p-6"
		data-testid="invitation-unreachable"
	>
		<h2 class="text-base font-semibold text-foreground">
			{INVITATION_PROBLEM_COPY.not_found.title}
		</h2>
		<p class="text-sm text-foreground">{INVITATION_PROBLEM_COPY.not_found.message}</p>
		<div>
			<Button variant="secondary" href={resolve('/workspace-invitations')}>Lihat undanganku</Button>
		</div>
	</div>
{:else}
	<InvitationCard {invitationId} {invitation} {token} />
{/if}

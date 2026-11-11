<script lang="ts">
	import EnvelopeSimple from 'phosphor-svelte/lib/EnvelopeSimple';
	import EmptyState from '$lib/components/feedback/EmptyState.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { workspaceErrorMessage } from '../presentation';
	import { createMyInvitationsQuery } from '../queries';
	import InvitationCard from './InvitationCard.svelte';

	/** On the notifications page the list only appears when there is something to answer. */
	let { hideWhenEmpty = false }: { hideWhenEmpty?: boolean } = $props();

	const invitationsQuery = createMyInvitationsQuery();
	const invitations = $derived(invitationsQuery.data ?? []);
</script>

{#if invitationsQuery.isPending}
	{#if !hideWhenEmpty}
		<div class="skeleton h-32 w-full" role="status" aria-label="Memuat undangan"></div>
	{/if}
{:else if invitationsQuery.isError}
	{#if !hideWhenEmpty}
		<div class="flex flex-wrap items-center gap-3" role="alert">
			<p class="text-sm text-error">
				{workspaceErrorMessage(invitationsQuery.error, 'Undangan belum bisa dimuat.')}
			</p>
			<Button variant="secondary" size="sm" onclick={() => invitationsQuery.refetch()}
				>Coba lagi</Button
			>
		</div>
	{/if}
{:else if invitations.length > 0}
	<section class="flex flex-col gap-3" aria-label="Undangan workspace" data-testid="my-invitations">
		{#each invitations as invitation (invitation.id)}
			<InvitationCard invitationId={invitation.id} {invitation} />
		{/each}
	</section>
{:else if !hideWhenEmpty}
	<EmptyState
		icon={EnvelopeSimple}
		tone="muted"
		title="Tidak ada undangan"
		description="Undangan workspace tim untuk email akunmu muncul di sini. Undangan yang dikirim ke email lain dibuka lewat tautan di email itu."
	/>
{/if}

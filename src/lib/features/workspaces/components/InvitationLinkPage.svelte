<script lang="ts">
	import { resolve } from '$app/paths';
	import Button from '$lib/components/ui/Button.svelte';
	import {
		INVITATION_PROBLEM_COPY,
		invitationProblem,
		workspaceErrorMessage
	} from '../presentation';
	import { createInvitationDetailsQuery } from '../queries';
	import InvitationCard from './InvitationCard.svelte';

	let { invitationId, token }: { invitationId: string; token?: string } = $props();

	// Read through the token, so a link sent to another address works from this account too.
	// Without a token the API only answers for an invitation addressed to this account's email.
	const detailsQuery = createInvitationDetailsQuery(
		() => invitationId,
		() => token ?? null
	);
	const problem = $derived(detailsQuery.isError ? invitationProblem(detailsQuery.error) : null);
	const copy = $derived(problem && problem !== 'other' ? INVITATION_PROBLEM_COPY[problem] : null);
</script>

{#if detailsQuery.isPending}
	<div class="skeleton h-40 w-full" role="status" aria-label="Memuat undangan"></div>
{:else if detailsQuery.isError}
	<div
		role="alert"
		class="surface-card flex flex-col gap-3 p-4 sm:p-6"
		data-testid="invitation-unreachable"
		data-problem={problem}
	>
		<h2 class="text-base font-semibold text-foreground">
			{copy?.title ?? 'Undangan belum bisa dimuat'}
		</h2>
		<p class="text-sm text-foreground">
			{copy?.message ?? workspaceErrorMessage(detailsQuery.error, 'Undangan belum bisa dimuat.')}
		</p>
		<div class="flex flex-wrap gap-2">
			{#if !copy}
				<Button onclick={() => detailsQuery.refetch()}>Coba lagi</Button>
			{:else if problem === 'already_accepted'}
				<Button href={resolve('/projects')}>Buka proyek</Button>
			{/if}
			<Button variant="secondary" href={resolve('/workspace-invitations')}>Lihat undanganku</Button>
		</div>
	</div>
{:else if detailsQuery.data}
	<InvitationCard {invitationId} invitation={detailsQuery.data} {token} />
{/if}

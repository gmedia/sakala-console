<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import EnvelopeSimple from 'phosphor-svelte/lib/EnvelopeSimple';
	import type { WorkspaceInvitation, WorkspaceRole } from '$lib/api/resources/workspaces';
	import Button from '$lib/components/ui/Button.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import { formatDate } from '$lib/utils/date';
	import { useActiveWorkspace } from '../access.svelte';
	import { createAcceptInvitationMutation, createDeclineInvitationMutation } from '../mutations';
	import {
		INVITATION_PROBLEM_COPY,
		ROLE_DESCRIPTIONS,
		ROLE_LABELS,
		invitationProblem,
		workspaceErrorMessage
	} from '../presentation';

	type Props = {
		invitationId: string;
		/** Details from the caller's invitation list; a link for another address has none. */
		invitation?: WorkspaceInvitation | null;
		/** From the email link. */
		token?: string;
	};

	let { invitationId, invitation = null, token }: Props = $props();

	const workspaces = useActiveWorkspace();
	const acceptMutation = createAcceptInvitationMutation();
	const declineMutation = createDeclineInvitationMutation();

	let outcome = $state<'accepted' | 'declined' | null>(null);
	let problem = $state<{ title: string; message: string; alreadyMember: boolean } | null>(null);
	let declineOpen = $state(false);
	let busy = false;

	const pending = $derived(acceptMutation.isPending || declineMutation.isPending);
	const role = $derived<WorkspaceRole | null>(invitation?.role ?? null);

	function explain(error: unknown, fallback: string) {
		const kind = invitationProblem(error);
		problem =
			kind === 'other'
				? {
						title: 'Belum berhasil',
						message: workspaceErrorMessage(error, fallback),
						alreadyMember: false
					}
				: { ...INVITATION_PROBLEM_COPY[kind], alreadyMember: kind === 'already_member' };
	}

	async function handleAccept() {
		if (busy) return;
		busy = true;
		problem = null;
		try {
			const workspace = await acceptMutation.mutateAsync({ invitationId, token });
			outcome = 'accepted';
			workspaces.select(workspace.id);
			toast.success(
				`Kamu sekarang ${ROLE_LABELS[workspace.role].toLowerCase()} di ${workspace.name}.`
			);
			await goto(resolve('/projects'));
		} catch (error) {
			explain(error, 'Undangan belum bisa diterima.');
		} finally {
			busy = false;
		}
	}

	async function handleDecline() {
		if (busy) return;
		busy = true;
		problem = null;
		try {
			await declineMutation.mutateAsync({ invitationId, token });
			declineOpen = false;
			outcome = 'declined';
		} catch (error) {
			declineOpen = false;
			explain(error, 'Undangan belum bisa ditolak.');
		} finally {
			busy = false;
		}
	}

	function openWorkspace() {
		const target = invitation
			? workspaces.workspaces.find((workspace) => workspace.id === invitation?.workspace.id)
			: undefined;
		if (target) workspaces.select(target.id);
		void goto(resolve('/projects'));
	}
</script>

<article class="surface-card flex flex-col gap-4 p-4 sm:p-6" data-testid="invitation-card">
	<div class="flex items-start gap-3">
		<span
			class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-dark"
			aria-hidden="true"
		>
			<EnvelopeSimple size={18} />
		</span>
		<div class="flex min-w-0 flex-col gap-1">
			<h2 class="text-base font-semibold wrap-anywhere text-foreground">
				{invitation ? `Undangan ke ${invitation.workspace.name}` : 'Undangan workspace tim'}
			</h2>
			{#if invitation}
				<p class="text-sm text-foreground">
					{invitation.invited_by?.name ?? 'Pemilik workspace'} mengundangmu sebagai
					<strong class="font-medium">{ROLE_LABELS[invitation.role].toLowerCase()}</strong>.
				</p>
				{#if role}
					<p class="text-sm text-muted">{ROLE_DESCRIPTIONS[role]}</p>
				{/if}
				<p class="text-xs text-muted">
					Berlaku sampai <time datetime={invitation.expires_at}
						>{formatDate(invitation.expires_at)}</time
					>.
				</p>
			{:else}
				<p class="text-sm text-muted">
					Kamu membuka tautan undangan dari email. Nama workspace dan peranmu tampil setelah
					undangan diterima.
				</p>
			{/if}
		</div>
	</div>

	{#if outcome === 'declined'}
		<p role="status" class="text-sm text-foreground">
			Undangan ditolak. Kalau berubah pikiran, minta pemilik workspace mengundangmu lagi.
		</p>
	{:else if outcome === 'accepted'}
		<p role="status" class="text-sm text-foreground">
			Undangan diterima. Membuka proyek workspace...
		</p>
	{:else if problem}
		<div
			role="alert"
			class="flex flex-col gap-2 rounded-control border border-warning/40 bg-accent-soft p-3 text-sm text-foreground"
			data-testid="invitation-problem"
		>
			<p class="font-semibold">{problem.title}</p>
			<p>{problem.message}</p>
			{#if problem.alreadyMember}
				<div>
					<Button size="sm" variant="secondary" onclick={openWorkspace}>Buka proyek</Button>
				</div>
			{/if}
		</div>
	{:else}
		<div class="flex flex-wrap gap-2">
			<Button onclick={handleAccept} disabled={pending} aria-busy={acceptMutation.isPending}>
				{acceptMutation.isPending ? 'Menerima...' : 'Terima undangan'}
			</Button>
			<Button variant="secondary" onclick={() => (declineOpen = true)} disabled={pending}>
				Tolak
			</Button>
		</div>
	{/if}
</article>

<Dialog
	bind:open={declineOpen}
	variant="destructive"
	title="Tolak undangan?"
	confirmLabel={declineMutation.isPending ? 'Menolak...' : 'Tolak undangan'}
	cancelLabel="Kembali"
	loading={declineMutation.isPending}
	onConfirm={handleDecline}
>
	<p class="text-sm text-foreground">
		Tautan undangan ini tidak bisa dipakai lagi setelah ditolak. Untuk bergabung nanti, kamu perlu
		undangan baru.
	</p>
</Dialog>

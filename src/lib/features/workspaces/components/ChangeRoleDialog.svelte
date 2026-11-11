<script lang="ts">
	import { toast } from 'svelte-sonner';
	import type { WorkspaceMember, WorkspaceRole } from '$lib/api/resources/workspaces';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import { createChangeRoleMutation } from '../mutations';
	import { LAST_OWNER_REASON, ROLE_LABELS, workspaceErrorMessage } from '../presentation';
	import RoleOptions from './RoleOptions.svelte';

	type Props = {
		open: boolean;
		workspaceId: string;
		member: WorkspaceMember | null;
		/** The last owner keeps the owner role: the API refuses anything else. */
		isLastOwner: boolean;
		isSelf: boolean;
		returnFocus?: () => HTMLElement | null | undefined;
	};

	let {
		open = $bindable(false),
		workspaceId,
		member,
		isLastOwner,
		isSelf,
		returnFocus
	}: Props = $props();

	const changeMutation = createChangeRoleMutation(() => workspaceId);

	let role = $state<WorkspaceRole>('member');
	let errorMessage = $state<string | null>(null);
	let submitting = false;

	$effect(() => {
		if (open && member) {
			role = member.role;
			errorMessage = null;
		}
	});

	const disabled = $derived<Partial<Record<WorkspaceRole, string>>>(
		isLastOwner ? { member: LAST_OWNER_REASON, viewer: LAST_OWNER_REASON } : {}
	);
	const losesOwnership = $derived(isSelf && member?.role === 'owner' && role !== 'owner');

	async function handleSave() {
		if (submitting || !member) return;
		if (role === member.role) {
			open = false;
			return;
		}
		submitting = true;
		errorMessage = null;
		try {
			await changeMutation.mutateAsync({ memberId: member.id, role });
			open = false;
			toast.success(`Peran ${member.user.name} sekarang ${ROLE_LABELS[role].toLowerCase()}.`);
		} catch (error) {
			errorMessage = workspaceErrorMessage(error, 'Peran belum bisa diubah.');
		} finally {
			submitting = false;
		}
	}
</script>

<Dialog
	bind:open
	title={`Ubah peran ${member?.user.name ?? ''}`.trim()}
	class="max-w-lg"
	confirmLabel={changeMutation.isPending ? 'Menyimpan...' : 'Simpan peran'}
	loading={changeMutation.isPending}
	initialFocus="cancel"
	{returnFocus}
	onConfirm={handleSave}
>
	<div class="flex flex-col gap-3">
		<RoleOptions name="member-role" legend="Peran" bind:value={role} {disabled} />
		{#if losesOwnership}
			<p
				class="rounded-control border border-warning/40 bg-accent-soft p-3 text-sm text-foreground"
			>
				Kamu tidak akan bisa lagi mengelola anggota, undangan, atau workspace ini setelah perannya
				diubah.
			</p>
		{/if}
		{#if errorMessage}
			<p
				role="alert"
				class="rounded-control border border-error/20 bg-error/10 px-3 py-2 text-sm text-foreground"
			>
				{errorMessage}
			</p>
		{/if}
	</div>
</Dialog>

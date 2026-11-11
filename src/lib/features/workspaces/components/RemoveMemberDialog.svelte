<script lang="ts">
	import { toast } from 'svelte-sonner';
	import type { WorkspaceMember } from '$lib/api/resources/workspaces';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import { createRemoveMemberMutation } from '../mutations';
	import { workspaceErrorMessage } from '../presentation';

	type Props = {
		open: boolean;
		workspaceId: string;
		workspaceName: string;
		member: WorkspaceMember | null;
		returnFocus?: () => HTMLElement | null | undefined;
	};

	let {
		open = $bindable(false),
		workspaceId,
		workspaceName,
		member,
		returnFocus
	}: Props = $props();

	const removeMutation = createRemoveMemberMutation(() => workspaceId);

	let errorMessage = $state<string | null>(null);
	let submitting = false;

	$effect(() => {
		if (open) errorMessage = null;
	});

	async function handleRemove() {
		if (submitting || !member) return;
		submitting = true;
		errorMessage = null;
		try {
			await removeMutation.mutateAsync(member.id);
			open = false;
			toast.success(`${member.user.name} dikeluarkan dari ${workspaceName}.`);
		} catch (error) {
			errorMessage = workspaceErrorMessage(error, 'Anggota belum bisa dikeluarkan.');
		} finally {
			submitting = false;
		}
	}
</script>

<Dialog
	bind:open
	variant="destructive"
	title={`Keluarkan ${member?.user.name ?? 'anggota'}?`}
	confirmLabel={removeMutation.isPending ? 'Mengeluarkan...' : 'Keluarkan'}
	cancelLabel="Batal"
	loading={removeMutation.isPending}
	{returnFocus}
	onConfirm={handleRemove}
>
	<div class="flex flex-col gap-3 text-sm text-foreground">
		<p>
			{member?.user.name ?? 'Anggota ini'} langsung kehilangan akses ke semua proyek di {workspaceName}.
			Proyek yang dia buat tetap milik workspace ini.
		</p>
		<p class="text-muted">Untuk bergabung lagi, dia perlu undangan baru.</p>
		{#if errorMessage}
			<p
				role="alert"
				class="rounded-control border border-error/20 bg-error/10 px-3 py-2 text-foreground"
			>
				{errorMessage}
			</p>
		{/if}
	</div>
</Dialog>

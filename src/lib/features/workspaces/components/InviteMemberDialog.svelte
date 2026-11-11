<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { getFieldError } from '$lib/api/errors';
	import type { WorkspaceRole } from '$lib/api/resources/workspaces';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import FormField from '$lib/components/ui/FormField.svelte';
	import { createInviteMutation } from '../mutations';
	import { workspaceErrorMessage } from '../presentation';
	import RoleOptions from './RoleOptions.svelte';

	type Props = {
		open: boolean;
		workspaceId: string;
		workspaceName: string;
	};

	let { open = $bindable(false), workspaceId, workspaceName }: Props = $props();

	const inviteMutation = createInviteMutation(() => workspaceId);

	let email = $state('');
	let role = $state<WorkspaceRole>('member');
	let emailError = $state<string | null>(null);
	let formError = $state<string | null>(null);
	let submitting = false;

	$effect(() => {
		if (open) {
			email = '';
			role = 'member';
			emailError = null;
			formError = null;
		}
	});

	// Enough to catch a typo; the API validates the address for real.
	const looksLikeEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

	async function handleInvite() {
		if (submitting) return;
		const address = email.trim();
		emailError = null;
		formError = null;
		if (!looksLikeEmail(address)) {
			emailError = 'Isi alamat email lengkap, misalnya nama@kampus.ac.id.';
			return;
		}

		submitting = true;
		try {
			await inviteMutation.mutateAsync({ email: address, role });
			open = false;
			toast.success(`Undangan dikirim ke ${address.toLowerCase()}.`);
		} catch (error) {
			emailError = getFieldError(error, 'email') ?? null;
			const roleError = getFieldError(error, 'role');
			if (!emailError) {
				formError = roleError ?? workspaceErrorMessage(error, 'Undangan belum terkirim.');
			}
		} finally {
			submitting = false;
		}
	}
</script>

<Dialog
	bind:open
	title="Undang anggota"
	description={`Orang yang diundang menerima email berisi tautan untuk bergabung ke ${workspaceName}. Mengundang email yang sama lagi mengganti undangan sebelumnya.`}
	descriptionClass="text-muted"
	class="max-w-lg"
	confirmLabel={inviteMutation.isPending ? 'Mengirim...' : 'Kirim undangan'}
	loading={inviteMutation.isPending}
	onConfirm={handleInvite}
>
	<form
		class="flex flex-col gap-4"
		novalidate
		onsubmit={(event) => {
			event.preventDefault();
			void handleInvite();
		}}
	>
		<FormField
			id="invite-email"
			label="Email"
			type="email"
			autocomplete="email"
			bind:value={email}
			placeholder="nama@kampus.ac.id"
			error={emailError}
			required
			oninput={() => (emailError = null)}
		/>
		<RoleOptions name="invite-role" bind:value={role} legend="Peran" />
		{#if role === 'owner'}
			<p class="text-sm text-muted" data-testid="owner-invite-note">
				Undangan sebagai pemilik hanya bisa diterima akun yang memakai email ini, dan tidak bisa
				diteruskan ke orang lain.
			</p>
		{/if}
		{#if formError}
			<p
				role="alert"
				class="rounded-control border border-error/20 bg-error/10 px-3 py-2 text-sm text-foreground"
			>
				{formError}
			</p>
		{/if}
	</form>
</Dialog>

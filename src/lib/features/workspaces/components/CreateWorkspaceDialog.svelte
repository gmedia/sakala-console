<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import { getFieldError } from '$lib/api/errors';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import FormField from '$lib/components/ui/FormField.svelte';
	import { useActiveWorkspace } from '../access.svelte';
	import { createCreateWorkspaceMutation } from '../mutations';
	import { workspaceErrorMessage } from '../presentation';

	let { open = $bindable(false) }: { open: boolean } = $props();

	const workspaces = useActiveWorkspace();
	const createMutation = createCreateWorkspaceMutation();

	let name = $state('');
	let nameError = $state<string | null>(null);
	let formError = $state<string | null>(null);
	// `isPending` flips a tick after mutate(), too late for a double click.
	let submitting = false;

	$effect(() => {
		if (open) {
			name = '';
			nameError = null;
			formError = null;
		}
	});

	async function handleCreate() {
		if (submitting) return;
		const trimmed = name.trim();
		nameError = null;
		formError = null;
		if (!trimmed) {
			nameError = 'Isi nama workspace, misalnya nama tim atau kelas kamu.';
			return;
		}
		if (trimmed.length > 100) {
			nameError = 'Nama workspace paling panjang 100 karakter.';
			return;
		}

		submitting = true;
		try {
			const workspace = await createMutation.mutateAsync(trimmed);
			workspaces.select(workspace.id);
			open = false;
			toast.success(`Workspace ${workspace.name} dibuat. Sekarang undang anggota tim kamu.`);
			await goto(resolve(`/workspaces/${workspace.id}`));
		} catch (error) {
			nameError = getFieldError(error, 'name') ?? null;
			if (!nameError) formError = workspaceErrorMessage(error, 'Workspace belum bisa dibuat.');
		} finally {
			submitting = false;
		}
	}
</script>

<Dialog
	bind:open
	title="Buat workspace tim"
	description="Proyek di workspace tim dimiliki bersama. Kamu menjadi pemiliknya dan bisa mengundang anggota lewat email."
	descriptionClass="text-muted"
	confirmLabel={createMutation.isPending ? 'Membuat...' : 'Buat workspace'}
	loading={createMutation.isPending}
	onConfirm={handleCreate}
>
	<form
		class="flex flex-col gap-3"
		novalidate
		onsubmit={(event) => {
			event.preventDefault();
			void handleCreate();
		}}
	>
		<FormField
			id="workspace-name"
			label="Nama workspace"
			bind:value={name}
			placeholder="Tim Facility Reporting"
			hint="Bisa diganti nanti. Paling panjang 100 karakter."
			error={nameError}
			required
			oninput={() => (nameError = null)}
		/>
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

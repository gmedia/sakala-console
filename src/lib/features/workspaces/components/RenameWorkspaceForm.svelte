<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { getFieldError } from '$lib/api/errors';
	import type { Workspace } from '$lib/api/resources/workspaces';
	import Button from '$lib/components/ui/Button.svelte';
	import FormField from '$lib/components/ui/FormField.svelte';
	import { createRenameWorkspaceMutation } from '../mutations';
	import { workspaceErrorMessage } from '../presentation';

	let { workspace }: { workspace: Pick<Workspace, 'id' | 'name' | 'slug'> } = $props();

	const renameMutation = createRenameWorkspaceMutation();

	// A rename elsewhere, or switching to another workspace, resets the field.
	let name = $derived(workspace.name);
	let nameError = $state<string | null>(null);
	let formError = $state<string | null>(null);
	let submitting = false;

	const dirty = $derived(name.trim() !== workspace.name);

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (submitting || !dirty) return;
		const trimmed = name.trim();
		nameError = null;
		formError = null;
		if (!trimmed) {
			nameError = 'Isi nama workspace.';
			return;
		}
		if (trimmed.length > 100) {
			nameError = 'Nama workspace paling panjang 100 karakter.';
			return;
		}
		submitting = true;
		try {
			const updated = await renameMutation.mutateAsync({
				workspaceId: workspace.id,
				name: trimmed
			});
			toast.success(`Nama workspace sekarang ${updated.name}.`);
		} catch (error) {
			nameError = getFieldError(error, 'name') ?? null;
			if (!nameError) formError = workspaceErrorMessage(error, 'Nama workspace belum tersimpan.');
		} finally {
			submitting = false;
		}
	}
</script>

<form
	class="surface-card flex flex-col gap-4 p-4 sm:p-6"
	aria-labelledby="rename-heading"
	novalidate
	onsubmit={handleSubmit}
>
	<h3 id="rename-heading" class="text-base font-semibold text-foreground">Nama workspace</h3>
	<FormField
		id="workspace-rename"
		label="Nama"
		bind:value={name}
		hint={`Alamat workspace tetap ${workspace.slug}, walaupun namanya diganti.`}
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
	<div>
		<Button
			type="submit"
			variant="secondary"
			disabled={!dirty || renameMutation.isPending}
			aria-busy={renameMutation.isPending}
		>
			{renameMutation.isPending ? 'Menyimpan...' : 'Simpan nama'}
		</Button>
	</div>
</form>

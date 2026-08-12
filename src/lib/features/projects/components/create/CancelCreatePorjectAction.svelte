<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/ui/Button.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import { getCreateProjectContext } from '$lib/features/projects/create/createProjectContext';

	const wizard = getCreateProjectContext();
	let showConfirm = $state(false);
	let cancelling = $state(false);

	function handleClick() {
		if (wizard.isDeploymentInProgress()) {
			showConfirm = true;
		} else {
			goto(resolve('/projects'));
		}
	}

	async function handleCancelDeployment() {
		cancelling = true;
		try {
			await wizard.cancelDeployment();
			showConfirm = false;
		} catch (error) {
			console.error('Failed to cancel deployment:', error);
		} finally {
			cancelling = false;
		}
	}
</script>

<Button variant="outline" onclick={handleClick} class="mb-4 px-3 border-2 border-muted text-muted">
	Batal
</Button>

<Dialog
	bind:open={showConfirm}
	class="text-center"
	title="Batalkan deployment ini?"
	description="Proses build sedang berjalan. Kalau dibatalkan sekarang, deployment ini akan dihentikan."
	confirmLabel="Ya, Batalkan"
	cancelLabel="Lanjutkan proses"
	variant="destructive"
	loading={cancelling}
	onConfirm={handleCancelDeployment}
/>

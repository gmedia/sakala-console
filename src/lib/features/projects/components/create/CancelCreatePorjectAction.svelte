<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/ui/Button.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import { getCreateProjectContext } from '$lib/features/projects/create/createProjectContext';

	const wizard = getCreateProjectContext();
	let showConfirm = $state(false);
	let showExitConfirm = $state(false);
	let cancelling = $state(false);

	const isFinished = $derived(
		wizard.deployStatus === 'success' ||
			wizard.deployStatus === 'failed' ||
			wizard.deployStatus === 'cancelled'
	);

	const buttonLabel = $derived(isFinished ? 'Selesai' : 'Batal');

	function handleClick() {
		if (wizard.isDeploymentInProgress()) {
			showConfirm = true;
			return;
		}

		if (isFinished || !wizard.hasUnsavedProgress) {
			goto(resolve('/projects'));
		} else {
			showExitConfirm = true;
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

	function handleExitWizard() {
		showExitConfirm = false;
		goto(resolve('/projects'));
	}
</script>

<Button
	variant="outline"
	disabled={wizard.deployStatus === 'cancelling'}
	onclick={handleClick}
	class="mb-4 px-3 border-2 border-muted text-muted"
>
	{buttonLabel}
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

<Dialog
	bind:open={showExitConfirm}
	class="text-center"
	title={wizard.exitDialogContent.title}
	description={wizard.exitDialogContent.description}
	confirmLabel="Ya, Keluar"
	cancelLabel="Lanjutkan"
	variant="destructive"
	onConfirm={handleExitWizard}
/>

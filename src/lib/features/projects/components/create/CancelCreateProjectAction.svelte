<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve, resolveRoute } from '$app/paths';
	import Button from '$lib/components/ui/Button.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import { getCreateProjectContext } from '$lib/features/projects/create/createProjectContext';

	const wizard = getCreateProjectContext();
	let showExitConfirm = $state(false);

	const projectId = $derived(wizard.createdProjectId);
	const label = $derived(projectId ? 'Keluar' : 'Batal');

	// Once the project exists, leaving must not sound like undoing: nothing here deletes it.
	const dialog = $derived(
		projectId
			? {
					title: 'Keluar dari proses ini?',
					description: `Proyek ${wizard.createdProjectName ?? 'ini'} sudah dibuat dan tetap tersimpan, tapi belum di-deploy. Keluar tidak menghapusnya. Kalau tidak jadi dipakai, hapus lewat tab Pengaturan di halaman proyek.`,
					confirmLabel: 'Ya, keluar'
				}
			: {
					title: 'Batalkan pembuatan proyek?',
					description:
						'Proyek belum dibuat. Kalau dibatalkan sekarang, konfigurasi yang sudah kamu isi akan hilang.',
					confirmLabel: 'Ya, batalkan'
				}
	);

	function leave() {
		showExitConfirm = false;
		if (projectId) {
			void goto(resolveRoute('/(app)/projects/[id]', { id: projectId }));
		} else {
			void goto(resolve('/projects'));
		}
	}

	function handleClick() {
		if (projectId || wizard.hasUnsavedProgress) {
			showExitConfirm = true;
		} else {
			leave();
		}
	}
</script>

<Button variant="secondary" size="sm" class="mb-4" onclick={handleClick}>
	{label}
</Button>

<Dialog
	bind:open={showExitConfirm}
	class="text-center"
	title={dialog.title}
	description={dialog.description}
	confirmLabel={dialog.confirmLabel}
	cancelLabel="Lanjutkan proses"
	emphasis="cancel"
	onConfirm={leave}
/>

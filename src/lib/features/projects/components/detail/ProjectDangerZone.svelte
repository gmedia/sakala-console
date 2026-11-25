<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolveRoute } from '$app/paths';
	import Trash from 'phosphor-svelte/lib/Trash';
	import { getErrorMessage } from '$lib/api/errors';
	import Button from '$lib/components/ui/Button.svelte';
	import { createDeleteProjectMutation } from '../../mutations';
	import { createPilotLimitsQuery } from '../../queries';
	import { SETTINGS_SECTION_IDS } from '../../settings-anchors';
	import type { Project } from '../../type';
	import DeleteProjectConfirmModal from './DeleteProjectConfirmModal.svelte';

	let { project }: { project: Project } = $props();

	const pilotLimits = createPilotLimitsQuery();
	const deleteMutation = createDeleteProjectMutation();

	let isDeleteDialogOpen = $state(false);
	let deleteError = $state('');
	// `isPending` updates a tick after mutate(), which is too late for a double click.
	let deleting = false;

	function handleOpenDelete() {
		deleteError = '';
		isDeleteDialogOpen = true;
	}

	function handleCloseDelete() {
		deleteError = '';
		isDeleteDialogOpen = false;
	}

	// The project query is dropped once the project is gone, which unmounts this page; the promise
	// of mutateAsync still settles, where callbacks given to mutate() would be skipped.
	async function handleConfirmDelete() {
		if (deleting) return;
		deleting = true;
		deleteError = '';
		const name = project.name ?? '';
		try {
			await deleteMutation.mutateAsync(project.id);
			isDeleteDialogOpen = false;
			toast.success(`Proyek ${name} dihapus.`.replace('  ', ' '));
			await goto(resolveRoute('/(app)/projects'));
		} catch (error) {
			deleteError = getErrorMessage(
				error,
				'Proyek belum terhapus. Muat ulang halaman, lalu hapus lagi.'
			);
		} finally {
			deleting = false;
		}
	}
</script>

<section
	id={SETTINGS_SECTION_IDS.danger}
	aria-labelledby="danger-zone-title"
	class="flex w-full scroll-mt-4 flex-col justify-between gap-4 rounded-card border border-error/40 bg-surface p-4 sm:flex-row sm:items-center sm:p-6"
>
	<div class="min-w-0">
		<h2 id="danger-zone-title" class="font-sans text-base font-semibold text-foreground">
			Zona berbahaya
		</h2>
		<p class="mt-1 text-sm text-foreground">
			Menghapus proyek menghentikan aplikasinya dan tidak bisa dibatalkan.
		</p>
	</div>

	<Button variant="danger" onclick={handleOpenDelete} disabled={deleteMutation.isPending}>
		<Trash size={16} aria-hidden="true" />
		Hapus proyek
	</Button>
</section>

<DeleteProjectConfirmModal
	open={isDeleteDialogOpen}
	projectName={project.name ?? project.project_name ?? ''}
	defaultDomain={project.default_domain ?? undefined}
	retentionDays={pilotLimits.data?.deleted_project_retention_days}
	isLoading={deleteMutation.isPending}
	error={deleteError}
	onConfirm={handleConfirmDelete}
	onClose={handleCloseDelete}
/>

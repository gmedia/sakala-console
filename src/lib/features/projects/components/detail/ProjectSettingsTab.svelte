<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolveRoute } from '$app/paths';
	import { Trash } from 'phosphor-svelte';
	import { createProjectQuery } from '../../queries';
	import { createDeleteProjectMutation } from '../../mutations';
	import { getProjectDetailContext } from '../../detail/projectDetailState.svelte';
	import DeleteProjectConfirmModal from './DeleteProjectConfirmModal.svelte';

	let { projectId }: { projectId: string } = $props();

	const projectQuery = createProjectQuery(() => projectId);
	const deleteMutation = createDeleteProjectMutation();
	const detailState = getProjectDetailContext();

	// Form State
	let name = $state('');
	let branch = $state('');

	// Read-only / auto-detected fields
	let subdomain = $state('');
	let port = $state('');
	let rootDirectory = $state('');
	let buildCommand = $state('');

	let isDeleteDialogOpen = $state(false);

	$effect(() => {
		if (projectQuery.data && !detailState?.isDirty) {
			name = projectQuery.data.name ?? projectQuery.data.project_name ?? '';
			branch = projectQuery.data.branch || '';

			subdomain = projectQuery.data.slug || '';
			port = projectQuery.data.detected_port
				? String(projectQuery.data.detected_port)
				: 'Belum terdeteksi';
			rootDirectory = 'Belum tersedia';
			buildCommand = 'Belum tersedia';
		}
	});

	$effect(() => {
		if (projectQuery.data) {
			const origName = projectQuery.data.name ?? projectQuery.data.project_name ?? '';
			const origBranch = projectQuery.data.branch || '';
			detailState?.setDraft(name, branch, origName, origBranch);
		}
	});

	function handleOpenDelete() {
		isDeleteDialogOpen = true;
	}

	function handleCloseDelete() {
		isDeleteDialogOpen = false;
	}

	function handleConfirmDelete() {
		deleteMutation.mutate(projectId, {
			onSuccess: () => {
				isDeleteDialogOpen = false;
				goto(resolveRoute('/(app)/projects'));
			}
		});
	}
</script>

<div class="flex flex-col w-280 max-w-full">
	{#if projectQuery.isLoading}
		<div class="p-6 text-center text-sm font-montserrat text-muted">Memuat pengaturan...</div>
	{:else if projectQuery.isError}
		<div class="p-6 text-center text-sm font-montserrat text-error">
			Gagal memuat data pengaturan proyek.
		</div>
	{:else if projectQuery.data}
		<form
			onsubmit={(e) => e.preventDefault()}
			class="flex w-280 max-w-full h-61 rounded-lg border border-border bg-surface pt-6 pb-6 shadow-none"
		>
			<div class="ml-6 w-132 flex flex-col">
				<div class="flex flex-col mb-4">
					<label for="projectName" class="font-montserrat-medium text-xs text-foreground mb-2">
						Nama Proyek
					</label>
					<input
						type="text"
						id="projectName"
						bind:value={name}
						placeholder="Nama Proyek"
						class="w-132 h-7.75 rounded-lg border border-border bg-background px-3 font-montserrat text-sm outline-none focus:border-primary transition-colors"
						required
					/>
				</div>

				<div class="flex flex-col mb-4">
					<label for="branch" class="font-montserrat-medium text-xs text-foreground mb-2">
						Branch
					</label>
					<input
						type="text"
						id="branch"
						bind:value={branch}
						placeholder="main"
						class="w-132 h-7.75 rounded-lg border border-border bg-background px-3 font-montserrat text-sm outline-none focus:border-primary transition-colors"
						required
					/>
				</div>

				<div class="flex flex-col">
					<div class="flex items-center gap-1.5 mb-2">
						<label for="rootDirectory" class="font-montserrat-medium text-xs text-foreground">
							Root Directory
						</label>
						<span class="text-[10px] text-muted font-montserrat">(Belum tersedia)</span>
					</div>
					<input
						type="text"
						id="rootDirectory"
						bind:value={rootDirectory}
						disabled
						placeholder="Belum tersedia"
						class="w-132 h-7.75 rounded-lg border border-border bg-surface-elevated/50 text-muted px-3 font-montserrat text-sm outline-none cursor-not-allowed"
					/>
				</div>
			</div>

			<div class="w-4 shrink-0"></div>

			<div class="mr-6 w-132 flex flex-col">
				<div class="flex flex-col mb-4">
					<div class="flex items-center gap-1.5 mb-2">
						<label for="subdomain" class="font-montserrat-medium text-xs text-foreground">
							Subdomain (URL Publik)
						</label>
						<span class="text-[10px] text-muted font-montserrat">(Otomatis)</span>
					</div>
					<input
						type="text"
						id="subdomain"
						bind:value={subdomain}
						disabled
						placeholder="subdomain"
						class="w-132 h-7.75 rounded-lg border border-border bg-surface-elevated/50 text-muted px-3 font-montserrat text-sm outline-none cursor-not-allowed"
					/>
				</div>

				<div class="flex flex-col mb-4">
					<div class="flex items-center gap-1.5 mb-2">
						<label for="port" class="font-montserrat-medium text-xs text-foreground"> Port </label>
						<span class="text-[10px] text-muted font-montserrat">
							{projectQuery.data.detected_port ? '(Terdeteksi)' : '(Belum terdeteksi)'}
						</span>
					</div>
					<input
						type="text"
						id="port"
						bind:value={port}
						disabled
						placeholder="Belum terdeteksi"
						class="w-132 h-7.75 rounded-lg border border-border bg-surface-elevated/50 text-muted px-3 font-montserrat text-sm outline-none cursor-not-allowed"
					/>
				</div>

				<div class="flex flex-col">
					<div class="flex items-center gap-1.5 mb-2">
						<label for="buildCommand" class="font-montserrat-medium text-xs text-foreground">
							Build command
						</label>
						<span class="text-[10px] text-muted font-montserrat">(Belum tersedia)</span>
					</div>
					<input
						type="text"
						id="buildCommand"
						bind:value={buildCommand}
						disabled
						placeholder="Belum tersedia"
						class="w-132 h-7.75 rounded-lg border border-border bg-surface-elevated/50 text-muted px-3 font-montserrat text-sm outline-none cursor-not-allowed"
					/>
				</div>
			</div>
		</form>

		<p class="mt-2 text-xs text-muted font-montserrat">
			Catatan: Perubahan nama proyek dan branch akan otomatis disimpan saat Anda melakukan <strong
				class="text-foreground">Redeploy</strong
			> pada banner di atas.
		</p>

		<div
			class="w-280 max-w-full h-20 rounded-lg border border-error/50 bg-error-50 mt-6 flex items-center justify-between shadow-none"
		>
			<div class="ml-4 flex flex-col justify-center">
				<h3 class="font-montserrat-semibold text-base text-error mb-2 leading-none">
					Hapus Proyek
				</h3>
				<p class="font-montserrat text-base text-error leading-none">
					Tindakan ini permanen dan tidak bisa dibatalkan.
				</p>
			</div>

			<button
				type="button"
				onclick={handleOpenDelete}
				disabled={deleteMutation.isPending}
				class="w-42 h-10 rounded-lg border border-error/50 bg-error-50 mr-4 flex items-center justify-between px-4 text-error hover:bg-error/10 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
			>
				<Trash size={24} weight="regular" />
				<span class="font-montserrat-semibold text-sm">Hapus Proyek</span>
			</button>
		</div>

		<DeleteProjectConfirmModal
			open={isDeleteDialogOpen}
			projectName={projectQuery.data.name ?? projectQuery.data.project_name ?? ''}
			defaultDomain={projectQuery.data.default_domain}
			isLoading={deleteMutation.isPending}
			onConfirm={handleConfirmDelete}
			onClose={handleCloseDelete}
		/>
	{/if}
</div>

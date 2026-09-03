<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolveRoute } from '$app/paths';
	import { Trash } from 'phosphor-svelte';
	import { createProjectQuery } from '../../queries';
	import { createUpdateProjectMutation, createDeleteProjectMutation } from '../../mutations';

	let { projectId }: { projectId: string } = $props();

	const projectQuery = createProjectQuery(() => projectId);
	const updateMutation = createUpdateProjectMutation();
	const deleteMutation = createDeleteProjectMutation();

	// Form State
	let name = $state('');
	let branch = $state('');

	// Unused by backend currently, but UI is requested
	let subdomain = $state('');
	let port = $state('');
	let rootDirectory = $state('');
	let buildCommand = $state('');

	$effect(() => {
		if (projectQuery.data) {
			name = projectQuery.data.project_name || '';
			branch = projectQuery.data.branch || '';

			subdomain = projectQuery.data.slug || '';
			port = projectQuery.data.detected_port?.toString() || '';
		}
	});

	function handleSubmit(e?: Event) {
		if (e) e.preventDefault();
		updateMutation.mutate({
			id: projectId,
			data: {
				name,
				branch
			}
		});
	}

	function handleDeleteProject() {
		if (
			confirm(
				'Apakah kamu yakin ingin menghapus proyek ini? Tindakan ini permanen dan tidak bisa dibatalkan.'
			)
		) {
			deleteMutation.mutate(projectId, {
				onSuccess: () => {
					goto(resolveRoute('/(app)/projects'));
				}
			});
		}
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
			onsubmit={handleSubmit}
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
					<label for="rootDirectory" class="font-montserrat-medium text-xs text-foreground mb-2">
						Root Directory
					</label>
					<input
						type="text"
						id="rootDirectory"
						bind:value={rootDirectory}
						placeholder="./"
						class="w-132 h-7.75 rounded-lg border border-border bg-background px-3 font-montserrat text-sm outline-none focus:border-primary transition-colors"
					/>
				</div>
			</div>

			<div class="w-4 shrink-0"></div>

			<div class="mr-6 w-132 flex flex-col">
				<div class="flex flex-col mb-4">
					<label for="subdomain" class="font-montserrat-medium text-xs text-foreground mb-2">
						Subdomain (URL Publik)
					</label>
					<input
						type="text"
						id="subdomain"
						bind:value={subdomain}
						placeholder="subdomain"
						class="w-132 h-7.75 rounded-lg border border-border bg-background px-3 font-montserrat text-sm outline-none focus:border-primary transition-colors"
					/>
				</div>

				<div class="flex flex-col mb-4">
					<label for="port" class="font-montserrat-medium text-xs text-foreground mb-2">
						Port
					</label>
					<input
						type="number"
						id="port"
						bind:value={port}
						placeholder="3000"
						class="w-132 h-7.75 rounded-lg border border-border bg-background px-3 font-montserrat text-sm outline-none focus:border-primary transition-colors"
					/>
				</div>

				<div class="flex flex-col">
					<label for="buildCommand" class="font-montserrat-medium text-xs text-foreground mb-2">
						Build command
					</label>
					<input
						type="text"
						id="buildCommand"
						bind:value={buildCommand}
						placeholder="npm run build"
						class="w-132 h-7.75 rounded-lg border border-border bg-background px-3 font-montserrat text-sm outline-none focus:border-primary transition-colors"
					/>
				</div>
			</div>
		</form>

		{#if updateMutation.isSuccess}
			<p class="mt-2 text-xs font-montserrat text-primary">
				Perubahan Nama Proyek & Branch berhasil disimpan ke sistem.
			</p>
		{/if}
		{#if updateMutation.isError}
			<p class="mt-2 text-xs font-montserrat text-error">Gagal menyimpan perubahan.</p>
		{/if}

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
				onclick={handleDeleteProject}
				disabled={deleteMutation.isPending}
				class="w-42 h-10 rounded-lg border border-error/50 bg-error-50 mr-4 flex items-center justify-between px-4 text-error hover:bg-error/10 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
			>
				<Trash size={24} weight="regular" />
				<span class="font-montserrat-semibold text-sm">Hapus Proyek</span>
			</button>
		</div>
	{/if}
</div>

<script lang="ts">
	import { untrack } from 'svelte';
	import type { Database, DatabaseAttachment } from '$lib/api/resources/databases';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Pagination from '$lib/components/ui/Pagination.svelte';
	import SearchInput from '$lib/components/ui/SearchInput.svelte';
	import { createListProjectsQuery, createProjectQuery } from '$lib/features/projects/queries';
	import { createAttachDatabaseMutation } from '../mutations';
	import { DATABASE_VARIABLES, databaseErrorMessage } from '../presentation';

	type Props = {
		open: boolean;
		workspaceId: string;
		database: Database;
		/** Chosen when the dialog opens, for example the project the user came from. */
		preselectedProjectId?: string | null;
		returnFocus?: () => HTMLElement | null | undefined;
		onAttached: (attachment: DatabaseAttachment) => void;
	};

	let {
		open = $bindable(false),
		workspaceId,
		database,
		preselectedProjectId = null,
		returnFocus,
		onAttached
	}: Props = $props();

	/** The API pages projects by at most six. */
	const PER_PAGE = 6;

	let search = $state('');
	let currentPage = $state(1);
	let selectedId = $state<string | null>(null);
	let formError = $state<string | null>(null);

	const attachMutation = createAttachDatabaseMutation();
	const projectsQuery = createListProjectsQuery(
		() => ({
			page: currentPage,
			per_page: PER_PAGE,
			filter: 'all',
			search: search.trim() || undefined,
			workspace_id: workspaceId
		}),
		() => ({ enabled: open })
	);
	const preselectedQuery = createProjectQuery(() => (open ? (preselectedProjectId ?? '') : ''));

	const attachedIds = $derived(new Set(database.projects.map((project) => project.id)));

	/** The other database a listed project already uses: one per project, so it cannot take this one. */
	function otherDatabaseOf(project: { databases?: { id: string; name: string }[] }): string | null {
		return project.databases?.find((item) => item.id !== database.id)?.name ?? null;
	}
	const projects = $derived(projectsQuery.data?.projects ?? []);
	const selectedName = $derived(
		projects.find((project) => project.id === selectedId)?.name ??
			(selectedId === preselectedProjectId ? preselectedQuery.data?.name : undefined)
	);

	// Only opening resets the form; a refetch of the database while it is open must not.
	$effect(() => {
		if (!open) return;
		untrack(() => {
			search = '';
			currentPage = 1;
			formError = null;
			selectedId =
				preselectedProjectId && !attachedIds.has(preselectedProjectId)
					? preselectedProjectId
					: null;
		});
	});

	async function attach() {
		formError = null;
		if (!selectedId) {
			formError = 'Pilih proyek yang akan memakai database ini.';
			return;
		}
		try {
			const attachment = await attachMutation.mutateAsync({
				workspaceId,
				databaseId: database.id,
				projectId: selectedId
			});
			open = false;
			onAttached(attachment);
		} catch (error) {
			formError = databaseErrorMessage(
				error,
				'attach',
				'Database belum terpasang. Muat ulang halaman, lalu pasang lagi.'
			);
		}
	}
</script>

<Dialog
	bind:open
	title="Pasang ke proyek"
	class="max-w-lg"
	descriptionClass="text-muted"
	confirmLabel={attachMutation.isPending ? 'Memasang...' : 'Pasang database'}
	loading={attachMutation.isPending}
	{returnFocus}
	onConfirm={attach}
>
	{#snippet description()}
		Proyek yang dipilih menerima <code class="font-mono text-xs text-foreground"
			>{DATABASE_VARIABLES[0]}</code
		>
		dan variabel <code class="font-mono text-xs text-foreground">DB_*</code> dari
		<span class="font-mono wrap-anywhere text-foreground">{database.name}</span> saat deploy berikutnya.
		Satu proyek hanya bisa memakai satu database.
	{/snippet}

	<div class="flex flex-col gap-3" data-testid="attach-dialog">
		<SearchInput
			placeholder="Cari proyek"
			debounce={300}
			onSearch={(value) => {
				search = value;
				currentPage = 1;
			}}
		/>

		<fieldset class="flex min-w-0 flex-col gap-2">
			<legend class="mb-1 text-sm font-medium text-foreground">Proyek di workspace ini</legend>
			{#if projectsQuery.isPending}
				<div class="skeleton h-28 w-full" role="status" aria-label="Memuat proyek"></div>
			{:else if projectsQuery.isError}
				<p class="text-sm text-error-dark" role="alert">
					Daftar proyek belum bisa dimuat. Tutup lalu buka lagi dialog ini.
				</p>
			{:else if projects.length === 0}
				<p class="text-sm text-muted">
					{search.trim()
						? `Tidak ada proyek bernama "${search.trim()}" di workspace ini.`
						: 'Workspace ini belum punya proyek. Buat proyek dulu, lalu pasang database ini.'}
				</p>
			{:else}
				<ul class="flex flex-col gap-1.5">
					{#each projects as project (project.id)}
						{@const attached = attachedIds.has(project.id)}
						{@const other = otherDatabaseOf(project)}
						{@const unavailable = attached || other !== null}
						<li>
							<label
								class="flex min-h-11 cursor-pointer items-center gap-3 rounded-control border px-3 py-2 text-sm has-checked:border-primary has-checked:bg-primary-50 has-disabled:cursor-not-allowed has-disabled:bg-background-soft {unavailable
									? 'border-border'
									: 'border-border-strong'}"
							>
								<input
									type="radio"
									name="attach-project"
									value={project.id}
									bind:group={selectedId}
									disabled={unavailable}
									class="size-4 shrink-0"
								/>
								<span class="min-w-0 flex-1 font-medium wrap-anywhere text-foreground"
									>{project.name}</span
								>
								{#if attached}
									<span class="shrink-0 text-xs text-muted">sudah terpasang</span>
								{:else if other}
									<span class="min-w-0 text-right text-xs wrap-anywhere text-muted"
										>memakai {other}</span
									>
								{/if}
							</label>
						</li>
					{/each}
				</ul>
				<Pagination
					currentPage={projectsQuery.data?.meta.current_page ?? currentPage}
					totalPages={projectsQuery.data?.meta.last_page ?? 1}
					disabled={projectsQuery.isFetching}
					onPageChange={(next) => (currentPage = next)}
				/>
			{/if}
		</fieldset>

		{#if selectedName}
			<p class="text-sm text-foreground" data-testid="attach-selected">
				Dipilih: <span class="font-medium wrap-anywhere">{selectedName}</span>
			</p>
		{/if}

		{#if formError}
			<p
				role="alert"
				class="rounded-control border border-error/20 bg-error/10 px-3 py-2 text-sm text-foreground"
				data-testid="attach-error"
			>
				{formError}
			</p>
		{/if}
	</div>
</Dialog>

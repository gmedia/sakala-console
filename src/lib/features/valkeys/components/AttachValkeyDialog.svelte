<script lang="ts">
	import { untrack } from 'svelte';
	import type { Valkey, ValkeyAttachment } from '$lib/api/resources/valkeys';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Pagination from '$lib/components/ui/Pagination.svelte';
	import SearchInput from '$lib/components/ui/SearchInput.svelte';
	import { createListProjectsQuery, createProjectQuery } from '$lib/features/projects/queries';
	import { createAttachValkeyMutation } from '../mutations';
	import { valkeyErrorMessage } from '../presentation';

	type Props = {
		open: boolean;
		workspaceId: string;
		valkey: Valkey;
		/** Chosen when the dialog opens, for example the project the user came from. */
		preselectedProjectId?: string | null;
		returnFocus?: () => HTMLElement | null | undefined;
		onAttached: (attachment: ValkeyAttachment) => void;
	};

	let {
		open = $bindable(false),
		workspaceId,
		valkey,
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

	const attachMutation = createAttachValkeyMutation();
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

	const attachedIds = $derived(new Set(valkey.projects.map((project) => project.id)));

	const projects = $derived(projectsQuery.data?.projects ?? []);
	const selectedName = $derived(
		projects.find((project) => project.id === selectedId)?.name ??
			(selectedId === preselectedProjectId ? preselectedQuery.data?.name : undefined)
	);

	// Only opening resets the form; a refetch of the store while it is open must not.
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
			formError = 'Pilih proyek yang akan memakai Valkey ini.';
			return;
		}
		try {
			const attachment = await attachMutation.mutateAsync({
				workspaceId,
				valkeyId: valkey.id,
				projectId: selectedId
			});
			open = false;
			onAttached(attachment);
		} catch (error) {
			formError = valkeyErrorMessage(
				error,
				'attach',
				'Valkey belum terpasang. Muat ulang halaman, lalu pasang lagi.'
			);
		}
	}
</script>

<Dialog
	bind:open
	title="Pasang ke proyek"
	class="max-w-lg"
	descriptionClass="text-muted"
	confirmLabel={attachMutation.isPending ? 'Memasang...' : 'Pasang Valkey'}
	loading={attachMutation.isPending}
	{returnFocus}
	onConfirm={attach}
>
	{#snippet description()}
		Proyek yang dipilih tersambung ke <span class="font-mono wrap-anywhere text-foreground"
			>{valkey.name}</span
		>
		dan menerima <code class="font-mono text-xs text-foreground">REDIS_*</code> saat deploy berikutnya.
		Satu proyek hanya bisa memakai satu Valkey, dan proyeknya harus berjalan di server yang sama.
	{/snippet}

	<div class="flex flex-col gap-3" data-testid="attach-valkey-dialog">
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
						: 'Workspace ini belum punya proyek. Buat proyek dulu, lalu pasang Valkey ini.'}
				</p>
			{:else}
				<ul class="flex flex-col gap-1.5">
					{#each projects as project (project.id)}
						{@const attached = attachedIds.has(project.id)}
						{@const unavailable = attached}
						<li>
							<label
								class="flex min-h-11 cursor-pointer items-center gap-3 rounded-control border px-3 py-2 text-sm has-checked:border-primary has-checked:bg-primary-50 has-disabled:cursor-not-allowed has-disabled:bg-background-soft {unavailable
									? 'border-border'
									: 'border-border-strong'}"
							>
								<input
									type="radio"
									name="attach-valkey-project"
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
			<p class="text-sm text-foreground" data-testid="attach-valkey-selected">
				Dipilih: <span class="font-medium wrap-anywhere">{selectedName}</span>
			</p>
		{/if}

		{#if formError}
			<p
				role="alert"
				class="rounded-control border border-error/20 bg-error/10 px-3 py-2 text-sm text-foreground"
				data-testid="attach-valkey-error"
			>
				{formError}
			</p>
		{/if}
	</div>
</Dialog>

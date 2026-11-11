<script lang="ts">
	import { resolve } from '$app/paths';
	import Badge from '$lib/components/ui/Badge.svelte';
	import AdminPageHeader from '../AdminPageHeader.svelte';
	import AdminError from '../AdminError.svelte';
	import AdminTable from '../AdminTable.svelte';
	import ListToolbar from '../ListToolbar.svelte';
	import FilterSelect from '../FilterSelect.svelte';
	import ListPagination from '../ListPagination.svelte';
	import { createAdminProjectsQuery } from '../../queries';
	import { useListUrl } from '../../list-url.svelte';
	import { readListState, toApiParams } from '../../url-state';
	import {
		PROJECT_STATUS_OPTIONS,
		RUNTIME_STATUS_OPTIONS,
		formatWibDate,
		projectStatus,
		runtimeStatus
	} from '../../format';
	import { formatRelativeTime } from '$lib/utils/date';

	const SPEC = {
		search: 'text',
		status: PROJECT_STATUS_OPTIONS.map((option) => option.value),
		runtime_status: RUNTIME_STATUS_OPTIONS.map((option) => option.value),
		suspended: ['1', '0'],
		workspace_id: 'id'
	} as const;

	const url = useListUrl();
	const list = $derived(readListState(url.search, SPEC));
	const query = createAdminProjectsQuery(() => toApiParams(list));
	const hasFilters = $derived(
		Boolean(
			list.search || list.status || list.runtime_status || list.suspended || list.workspace_id
		)
	);
</script>

<AdminPageHeader
	title="Proyek"
	crumbs={[{ label: 'Proyek' }]}
	description="Semua proyek di semua workspace. Buka proyek untuk menghentikan, menangguhkan, atau merekonsiliasi workload-nya."
/>

<ListToolbar
	id="projects"
	searchLabel="Cari nama, slug, atau owner/repo"
	search={list.search}
	onSearch={(value) => url.update({ search: value }, { replace: true })}
	{hasFilters}
	onReset={() =>
		url.update({
			search: null,
			status: null,
			runtime_status: null,
			suspended: null,
			workspace_id: null
		})}
>
	{#snippet filters()}
		<FilterSelect
			id="projects-runtime"
			label="Runtime"
			value={list.runtime_status}
			options={RUNTIME_STATUS_OPTIONS}
			onChange={(value) => url.update({ runtime_status: value })}
		/>
		<FilterSelect
			id="projects-status"
			label="Status"
			value={list.status}
			options={PROJECT_STATUS_OPTIONS}
			onChange={(value) => url.update({ status: value })}
		/>
		<FilterSelect
			id="projects-suspended"
			label="Penangguhan"
			value={list.suspended}
			options={[
				{ value: '1', label: 'Ditangguhkan' },
				{ value: '0', label: 'Tidak ditangguhkan' }
			]}
			onChange={(value) => url.update({ suspended: value })}
		/>
	{/snippet}
</ListToolbar>
{#if list.workspace_id}
	<p class="mb-3 text-sm text-muted">
		Hanya proyek dari satu workspace. <a
			href={resolve(`/admin/workspaces/${list.workspace_id}`)}
			class="inline-flex min-h-6 items-center underline underline-offset-2">Buka workspace</a
		>
	</p>
{/if}

{#if query.isError && !query.data}
	<AdminError error={query.error} what="daftar proyek" onRetry={() => query.refetch()} />
{:else}
	<AdminTable
		caption="Daftar proyek"
		columns={[
			{ label: 'Proyek' },
			{ label: 'Runtime' },
			{ label: 'Workspace' },
			{ label: 'Pembuat' },
			{ label: 'Deploy terakhir' },
			{ label: 'Dibuat' }
		]}
		loading={query.isPending}
		fetching={query.isPlaceholderData}
		empty={query.data?.data.length === 0}
		emptyTitle={hasFilters ? 'Tidak ada proyek yang cocok' : 'Belum ada proyek'}
		emptyText={hasFilters ? 'Ubah pencarian atau hapus filter.' : ''}
	>
		{#snippet rows()}
			{#each query.data?.data ?? [] as project (project.id)}
				{@const runtime = runtimeStatus(project.runtime_status)}
				<tr class="hover:bg-background">
					<td class="px-4 py-3">
						<a
							href={resolve(`/admin/projects/${project.id}`)}
							class="inline-flex min-h-6 items-center font-medium underline underline-offset-2"
							>{project.name}</a
						>
						<p class="text-xs wrap-anywhere text-muted">
							{project.repository_full_name ?? project.slug}
						</p>
					</td>
					<td class="px-4 py-3">
						<div class="flex flex-wrap gap-1">
							<Badge tone={runtime.tone}>{runtime.label}</Badge>
							{#if project.status === 'suspended'}
								{@const status = projectStatus(project.status)}
								<Badge tone={status.tone}>{status.label}</Badge>
							{/if}
						</div>
					</td>
					<td class="px-4 py-3">
						{#if project.workspace}
							<a
								href={resolve(`/admin/workspaces/${project.workspace.id}`)}
								class="inline-flex min-h-6 items-center underline underline-offset-2"
								>{project.workspace.name}</a
							>
						{:else}-{/if}
					</td>
					<td class="px-4 py-3"
						>{project.creator ? `@${project.creator.username}` : 'Akun dihapus'}</td
					>
					<td class="px-4 py-3 whitespace-nowrap"
						>{project.last_deployed_at
							? formatRelativeTime(project.last_deployed_at)
							: 'Belum pernah'}</td
					>
					<td class="px-4 py-3 whitespace-nowrap">{formatWibDate(project.created_at)}</td>
				</tr>
			{/each}
		{/snippet}
	</AdminTable>
	<ListPagination
		meta={query.data?.meta}
		noun="proyek"
		busy={query.isFetching}
		onPageChange={(page) => url.update({ page })}
	/>
{/if}

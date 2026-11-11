<script lang="ts">
	import { resolve } from '$app/paths';
	import Badge from '$lib/components/ui/Badge.svelte';
	import AdminPageHeader from '../AdminPageHeader.svelte';
	import AdminError from '../AdminError.svelte';
	import AdminTable from '../AdminTable.svelte';
	import ListToolbar from '../ListToolbar.svelte';
	import FilterSelect from '../FilterSelect.svelte';
	import ListPagination from '../ListPagination.svelte';
	import { createAdminWorkspacesQuery, createLimitProfileOptionsQuery } from '../../queries';
	import { useListUrl } from '../../list-url.svelte';
	import { readListState, toApiParams } from '../../url-state';
	import { WORKSPACE_TYPE_LABELS, formatNumber, formatWibDate } from '../../format';

	const SPEC = { search: 'text', type: ['personal', 'team'], limit_profile_id: 'id' } as const;

	const url = useListUrl();
	const list = $derived(readListState(url.search, SPEC));
	const query = createAdminWorkspacesQuery(() => toApiParams(list));
	const profilesQuery = createLimitProfileOptionsQuery();
	const hasFilters = $derived(Boolean(list.search || list.type || list.limit_profile_id));
</script>

<AdminPageHeader
	title="Workspace"
	crumbs={[{ label: 'Workspace' }]}
	description="Workspace pribadi dan tim, dengan profil batas yang dipakai masing-masing."
/>

<ListToolbar
	id="workspaces"
	searchLabel="Cari nama atau slug workspace"
	search={list.search}
	onSearch={(value) => url.update({ search: value }, { replace: true })}
	{hasFilters}
	onReset={() => url.update({ search: null, type: null, limit_profile_id: null })}
>
	{#snippet filters()}
		<FilterSelect
			id="workspaces-type"
			label="Tipe"
			value={list.type}
			options={[
				{ value: 'personal', label: 'Pribadi' },
				{ value: 'team', label: 'Tim' }
			]}
			onChange={(value) => url.update({ type: value })}
		/>
		<FilterSelect
			id="workspaces-profile"
			label="Profil batas"
			value={list.limit_profile_id}
			options={(profilesQuery.data?.data ?? []).map((profile) => ({
				value: profile.id,
				label: profile.name
			}))}
			onChange={(value) => url.update({ limit_profile_id: value })}
		/>
	{/snippet}
</ListToolbar>

{#if query.isError && !query.data}
	<AdminError error={query.error} what="daftar workspace" onRetry={() => query.refetch()} />
{:else}
	<AdminTable
		caption="Daftar workspace"
		columns={[
			{ label: 'Workspace' },
			{ label: 'Tipe' },
			{ label: 'Profil batas' },
			{ label: 'Anggota', class: 'text-right' },
			{ label: 'Proyek', class: 'text-right' },
			{ label: 'Dibuat' }
		]}
		loading={query.isPending}
		fetching={query.isPlaceholderData}
		empty={query.data?.data.length === 0}
		emptyTitle={hasFilters ? 'Tidak ada workspace yang cocok' : 'Belum ada workspace'}
		emptyText={hasFilters ? 'Ubah pencarian atau hapus filter.' : ''}
	>
		{#snippet rows()}
			{#each query.data?.data ?? [] as workspace (workspace.id)}
				<tr class="hover:bg-background">
					<td class="px-4 py-3">
						<a
							href={resolve(`/admin/workspaces/${workspace.id}`)}
							class="inline-flex min-h-6 items-center font-medium underline underline-offset-2"
							>{workspace.name}</a
						>
						<p class="text-xs text-muted">
							{workspace.personal_user
								? `Milik @${workspace.personal_user.username}`
								: workspace.slug}
						</p>
					</td>
					<td class="px-4 py-3">
						<Badge tone={workspace.type === 'team' ? 'running' : 'neutral'}
							>{WORKSPACE_TYPE_LABELS[workspace.type] ?? workspace.type}</Badge
						>
					</td>
					<td class="px-4 py-3">{workspace.limit_profile?.name ?? 'Default'}</td>
					<td class="px-4 py-3 text-right tabular-nums"
						>{formatNumber(workspace.members_count ?? 0)}</td
					>
					<td class="px-4 py-3 text-right tabular-nums"
						>{formatNumber(workspace.projects_count ?? 0)}</td
					>
					<td class="px-4 py-3 whitespace-nowrap">{formatWibDate(workspace.created_at)}</td>
				</tr>
			{/each}
		{/snippet}
	</AdminTable>
	<ListPagination
		meta={query.data?.meta}
		noun="workspace"
		busy={query.isFetching}
		onPageChange={(page) => url.update({ page })}
	/>
{/if}

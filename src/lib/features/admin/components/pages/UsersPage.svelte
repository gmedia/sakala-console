<script lang="ts">
	import { resolve } from '$app/paths';
	import Badge from '$lib/components/ui/Badge.svelte';
	import AdminPageHeader from '../AdminPageHeader.svelte';
	import AdminError from '../AdminError.svelte';
	import AdminTable from '../AdminTable.svelte';
	import ListToolbar from '../ListToolbar.svelte';
	import FilterSelect from '../FilterSelect.svelte';
	import ListPagination from '../ListPagination.svelte';
	import { createAdminUsersQuery } from '../../queries';
	import { useListUrl } from '../../list-url.svelte';
	import { readListState, toApiParams } from '../../url-state';
	import { ROLE_LABELS, formatWibDate, formatNumber, onboardingSourceLabel } from '../../format';
	import { formatRelativeTime } from '$lib/utils/date';

	const SPEC = { search: 'text', role: ['user', 'admin'], verified: ['1', '0'] } as const;

	const url = useListUrl();
	const list = $derived(readListState(url.search, SPEC));
	const query = createAdminUsersQuery(() => toApiParams(list));
	const hasFilters = $derived(Boolean(list.search || list.role || list.verified));
</script>

<AdminPageHeader
	title="Pengguna"
	crumbs={[{ label: 'Pengguna' }]}
	description="Cari akun, lihat workspace-nya, dan atur peran serta batasnya."
/>

<ListToolbar
	id="users"
	searchLabel="Cari nama, username, atau email"
	search={list.search}
	onSearch={(value) => url.update({ search: value }, { replace: true })}
	{hasFilters}
	onReset={() => url.update({ search: null, role: null, verified: null })}
>
	{#snippet filters()}
		<FilterSelect
			id="users-role"
			label="Peran"
			value={list.role}
			options={[
				{ value: 'admin', label: 'Admin' },
				{ value: 'user', label: 'Pengguna' }
			]}
			onChange={(value) => url.update({ role: value })}
		/>
		<FilterSelect
			id="users-verified"
			label="Email"
			value={list.verified}
			options={[
				{ value: '1', label: 'Terverifikasi' },
				{ value: '0', label: 'Belum terverifikasi' }
			]}
			onChange={(value) => url.update({ verified: value })}
		/>
	{/snippet}
</ListToolbar>

{#if query.isError && !query.data}
	<AdminError error={query.error} what="daftar pengguna" onRetry={() => query.refetch()} />
{:else}
	<AdminTable
		caption="Daftar pengguna"
		columns={[
			{ label: 'Pengguna' },
			{ label: 'Peran' },
			{ label: 'Email' },
			{ label: 'Proyek', class: 'text-right' },
			{ label: 'Sumber' },
			{ label: 'Terakhir masuk' },
			{ label: 'Terdaftar' }
		]}
		loading={query.isPending}
		fetching={query.isPlaceholderData}
		empty={query.data?.data.length === 0}
		emptyTitle={hasFilters ? 'Tidak ada pengguna yang cocok' : 'Belum ada pengguna'}
		emptyText={hasFilters ? 'Ubah pencarian atau hapus filter.' : ''}
	>
		{#snippet rows()}
			{#each query.data?.data ?? [] as user (user.id)}
				<tr class="hover:bg-background">
					<td class="px-4 py-3">
						<a
							href={resolve(`/admin/users/${String(user.id)}`)}
							class="inline-flex min-h-6 items-center font-medium text-foreground underline underline-offset-2"
						>
							{user.name}
						</a>
						<p class="text-xs text-muted">@{user.username}</p>
					</td>
					<td class="px-4 py-3">
						<Badge tone={user.role === 'admin' ? 'running' : 'neutral'}>
							{ROLE_LABELS[user.role] ?? user.role}
						</Badge>
					</td>
					<td class="px-4 py-3">
						<p class="wrap-anywhere">{user.email}</p>
						<p class="text-xs {user.email_verified ? 'text-muted' : 'text-warning'}">
							{user.email_verified ? 'Terverifikasi' : 'Belum terverifikasi'}
						</p>
					</td>
					<td class="px-4 py-3 text-right tabular-nums">
						{user.created_projects_count === undefined
							? '-'
							: formatNumber(user.created_projects_count)}
					</td>
					<td class="px-4 py-3">{onboardingSourceLabel(user.onboarding_source)}</td>
					<td class="px-4 py-3 whitespace-nowrap">
						{user.last_login_at ? formatRelativeTime(user.last_login_at) : 'Belum pernah'}
					</td>
					<td class="px-4 py-3 whitespace-nowrap">{formatWibDate(user.created_at)}</td>
				</tr>
			{/each}
		{/snippet}
	</AdminTable>
	<ListPagination
		meta={query.data?.meta}
		noun="pengguna"
		busy={query.isFetching}
		onPageChange={(page) => url.update({ page })}
	/>
{/if}

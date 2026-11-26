<script lang="ts">
	// Links here are resolve() output, some with a query string added, which the rule cannot follow.
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import Plus from 'phosphor-svelte/lib/Plus';
	import Button from '$lib/components/ui/Button.svelte';
	import { ApiError } from '$lib/api/errors';
	import type { LimitProfile } from '$lib/api/resources/admin/accounts';
	import ListPageLayout from '$lib/components/layout/templates/ListPageLayout.svelte';
	import AdminPageHeader from '../AdminPageHeader.svelte';
	import AdminError from '../AdminError.svelte';
	import AdminTable from '../AdminTable.svelte';
	import ListToolbar from '../ListToolbar.svelte';
	import ListPagination from '../ListPagination.svelte';
	import ReasonDialog from '../ReasonDialog.svelte';
	import { createLimitProfilesQuery } from '../../queries';
	import { createDeleteLimitProfileMutation } from '../../mutations';
	import { useListUrl } from '../../list-url.svelte';
	import { readListState, toApiParams } from '../../url-state';
	import {
		formatNumber,
		formatProfileBuildsPerHour,
		formatProfileIdleSleep,
		formatProfileMaxReplicas
	} from '../../format';
	import { RETURN_TO_PARAM } from '../../return-to';

	const SPEC = { search: 'text' } as const;
	/** The old way to open the create form, still in bookmarks and older Console tabs. */
	const LEGACY_CREATE_PARAM = 'create';

	const url = useListUrl();
	const list = $derived(readListState(url.search, SPEC));
	const query = createLimitProfilesQuery(() => toApiParams(list));

	const deleteMutation = createDeleteLimitProfileMutation();
	const newHref = resolve('/admin/limit-profiles/new');

	let deleting = $state<LimitProfile | null>(null);
	let deleteError = $state<unknown>(null);

	// The create form has its own page now; a link from before goes there, with where to return.
	let legacyLinkHandled = false;
	$effect(() => {
		if (legacyLinkHandled || url.search.get(LEGACY_CREATE_PARAM) !== '1') return;
		legacyLinkHandled = true;
		const returnTo = url.search.get(RETURN_TO_PARAM);
		void goto(
			returnTo ? `${newHref}?${RETURN_TO_PARAM}=${encodeURIComponent(returnTo)}` : newHref,
			{ replaceState: true }
		);
	});

	async function remove(reason: string) {
		if (!deleting) return;
		deleteError = null;
		const target = deleting;
		try {
			await deleteMutation.mutateAsync({ id: target.id, reason });
			deleting = null;
			toast.success(`Profil ${target.name} dihapus.`);
		} catch (error) {
			deleteError = error;
		}
	}

	const inUse = $derived(
		deleteError instanceof ApiError && deleteError.code === 'LIMIT_PROFILE_IN_USE'
	);
</script>

<AdminPageHeader title="Profil batas" crumbs={[{ label: 'Profil batas' }]}>
	{#snippet actions()}
		<Button href={newHref}>
			<Plus size={16} weight="bold" aria-hidden="true" />
			Buat profil
		</Button>
	{/snippet}
</AdminPageHeader>

<ListPageLayout>
	{#snippet controls()}
		<ListToolbar
			id="profiles"
			searchLabel="Cari nama profil"
			search={list.search}
			onSearch={(value) => url.update({ search: value }, { replace: true })}
			hasFilters={Boolean(list.search)}
			onReset={() => url.update({ search: null })}
		/>
	{/snippet}

	{#if query.isError && !query.data}
		<AdminError error={query.error} what="profil batas" onRetry={() => query.refetch()} />
	{:else}
		<div class="flex min-w-0 flex-col">
			<AdminTable
				caption="Daftar profil batas"
				columns={[
					{ label: 'Profil' },
					{ label: 'Proyek', class: 'text-right' },
					{ label: 'Container', class: 'text-right' },
					{ label: 'Deployment', class: 'text-right' },
					{ label: 'Memori', class: 'text-right' },
					{ label: 'CPU', class: 'text-right' },
					{ label: 'Build/jam', class: 'text-right' },
					{ label: 'Tidur', class: 'text-right' },
					{ label: 'Replika', class: 'text-right' },
					{ label: 'Dipakai', class: 'text-right' },
					{ label: 'Aksi', srOnly: true }
				]}
				loading={query.isPending}
				fetching={query.isPlaceholderData}
				empty={query.data?.data.length === 0}
				emptyTitle={list.search ? 'Tidak ada profil yang cocok' : 'Belum ada profil batas'}
				emptyText={list.search ? '' : 'Tanpa profil, workspace memakai batas default tipenya.'}
			>
				{#snippet rows()}
					{#each query.data?.data ?? [] as profile (profile.id)}
						<tr>
							<th scope="row" class="px-4 py-3 text-left font-medium">{profile.name}</th>
							<td class="px-4 py-3 text-right tabular-nums">{formatNumber(profile.max_projects)}</td
							>
							<td class="px-4 py-3 text-right tabular-nums"
								>{formatNumber(profile.max_active_containers)}</td
							>
							<td class="px-4 py-3 text-right tabular-nums"
								>{formatNumber(profile.max_active_deployments)}</td
							>
							<td class="px-4 py-3 text-right whitespace-nowrap tabular-nums"
								>{formatNumber(profile.max_memory_mb)} MB</td
							>
							<td class="px-4 py-3 text-right whitespace-nowrap tabular-nums"
								>{formatNumber(profile.max_cpu_millis)} m</td
							>
							<td class="px-4 py-3 text-right whitespace-nowrap tabular-nums"
								>{formatProfileBuildsPerHour(profile.max_builds_per_hour)}</td
							>
							<td class="px-4 py-3 text-right whitespace-nowrap tabular-nums"
								>{formatProfileIdleSleep(profile.idle_sleep_minutes)}</td
							>
							<td class="px-4 py-3 text-right whitespace-nowrap tabular-nums"
								>{formatProfileMaxReplicas(profile.max_replicas)}</td
							>
							<td class="px-4 py-3 text-right">
								<a
									href={`${resolve('/admin/workspaces')}?limit_profile_id=${profile.id}`}
									class="inline-flex min-h-6 items-center whitespace-nowrap underline underline-offset-2"
								>
									{formatNumber(profile.workspaces_count ?? 0)} workspace
								</a>
							</td>
							<td class="px-4 py-3">
								<div class="flex justify-end gap-2">
									<Button
										size="sm"
										variant="secondary"
										href={resolve(`/admin/limit-profiles/${profile.id}`)}
										aria-label={`Ubah ${profile.name}`}>Ubah</Button
									>
									<Button
										size="sm"
										variant="secondary"
										class="text-error hover:border-error hover:text-error"
										aria-label={`Hapus ${profile.name}`}
										onclick={() => {
											deleteError = null;
											deleting = profile;
										}}
									>
										Hapus
									</Button>
								</div>
							</td>
						</tr>
					{/each}
				{/snippet}
			</AdminTable>
			<ListPagination
				meta={query.data?.meta}
				noun="profil"
				busy={query.isFetching}
				onPageChange={(page) => url.update({ page })}
			/>
		</div>
	{/if}
</ListPageLayout>

<ReasonDialog
	open={deleting !== null}
	id="profile-delete"
	title="Hapus profil batas?"
	subject={deleting ? `Profil ${deleting.name}` : ''}
	consequence="Profil hanya bisa dihapus kalau tidak ada workspace yang memakainya. Penghapusan tidak bisa dibatalkan."
	confirmLabel="Hapus profil"
	variant="destructive"
	error={deleteError}
	onCancel={() => (deleting = null)}
	onConfirm={remove}
>
	{#snippet fields()}
		{#if inUse && deleting}
			<p class="text-sm">
				<a
					href={`${resolve('/admin/workspaces')}?limit_profile_id=${deleting.id}`}
					class="inline-flex min-h-6 items-center font-medium text-primary-dark underline underline-offset-2"
				>
					Lihat workspace yang memakai profil ini
				</a>
				lalu ganti profilnya di sana.
			</p>
		{/if}
	{/snippet}
</ReasonDialog>

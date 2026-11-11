<script lang="ts">
	// Links here are resolve() output, some with a query string added, which the rule cannot follow.
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import Plus from 'phosphor-svelte/lib/Plus';
	import Button from '$lib/components/ui/Button.svelte';
	import { ApiError, getFieldError } from '$lib/api/errors';
	import type { LimitProfile, LimitProfileFields } from '$lib/api/resources/admin/accounts';
	import AdminPageHeader from '../AdminPageHeader.svelte';
	import AdminError from '../AdminError.svelte';
	import AdminTable from '../AdminTable.svelte';
	import ListToolbar from '../ListToolbar.svelte';
	import ListPagination from '../ListPagination.svelte';
	import ReasonDialog from '../ReasonDialog.svelte';
	import { createLimitProfilesQuery } from '../../queries';
	import {
		createDeleteLimitProfileMutation,
		createSaveLimitProfileMutation
	} from '../../mutations';
	import { useListUrl } from '../../list-url.svelte';
	import { readListState, toApiParams } from '../../url-state';
	import { formatNumber } from '../../format';

	const SPEC = { search: 'text' } as const;
	const url = useListUrl();
	const list = $derived(readListState(url.search, SPEC));
	const query = createLimitProfilesQuery(() => toApiParams(list));

	const saveMutation = createSaveLimitProfileMutation();
	const deleteMutation = createDeleteLimitProfileMutation();

	type NumberField = Exclude<keyof LimitProfileFields, 'name'>;

	/** The API's own ranges (StoreLimitProfileRequest), so most mistakes show before sending. */
	const NUMBER_FIELDS: {
		key: NumberField;
		label: string;
		min: number;
		max: number;
		hint: string;
		optional?: boolean;
	}[] = [
		{
			key: 'max_projects',
			label: 'Proyek',
			min: 1,
			max: 1000,
			hint: 'Jumlah proyek per workspace.'
		},
		{
			key: 'max_active_containers',
			label: 'Container berjalan',
			min: 1,
			max: 1000,
			hint: 'Proyek yang melayani atau sedang di-deploy sekaligus.'
		},
		{
			key: 'max_active_deployments',
			label: 'Deployment berjalan',
			min: 1,
			max: 100,
			hint: 'Deployment yang berjalan bersamaan.'
		},
		{
			key: 'max_memory_mb',
			label: 'Memori per proyek (MB)',
			min: 64,
			max: 65536,
			hint: '64 sampai 65.536 MB.'
		},
		{
			key: 'max_cpu_millis',
			label: 'CPU per proyek (millicore)',
			min: 100,
			max: 64000,
			hint: '1.000 millicore sama dengan satu core.'
		},
		{
			key: 'max_builds_per_hour',
			label: 'Build per jam',
			min: 1,
			max: 1000,
			hint: 'Opsional. Belum ditegakkan API, disimpan untuk nanti.',
			optional: true
		}
	];

	let editing = $state<LimitProfile | null>(null);
	let formOpen = $state(false);
	let formError = $state<unknown>(null);
	let name = $state('');
	let values = $state<Record<NumberField, string>>({
		max_projects: '',
		max_active_containers: '',
		max_active_deployments: '',
		max_memory_mb: '',
		max_cpu_millis: '',
		max_builds_per_hour: ''
	});

	let deleting = $state<LimitProfile | null>(null);
	let deleteError = $state<unknown>(null);

	function openForm(profile: LimitProfile | null) {
		editing = profile;
		formError = null;
		name = profile?.name ?? '';
		for (const field of NUMBER_FIELDS) {
			values[field.key] = profile?.[field.key]?.toString() ?? '';
		}
		formOpen = true;
	}

	function fieldProblem(field: (typeof NUMBER_FIELDS)[number]): string | null {
		const raw = values[field.key].trim();
		if (!raw) return field.optional ? null : 'Wajib diisi.';
		const value = Number(raw);
		if (!Number.isInteger(value) || value < field.min || value > field.max) {
			return `Bilangan bulat ${formatNumber(field.min)} sampai ${formatNumber(field.max)}.`;
		}
		return null;
	}

	const formInvalid = $derived(
		!name.trim() || name.length > 100 || NUMBER_FIELDS.some((field) => fieldProblem(field) !== null)
	);

	async function save(reason: string) {
		formError = null;
		const numbers = Object.fromEntries(
			NUMBER_FIELDS.map((field) => {
				const raw = values[field.key].trim();
				return [field.key, raw ? Number(raw) : null];
			})
		) as Pick<LimitProfileFields, NumberField>;
		const fields: LimitProfileFields = { ...numbers, name: name.trim() };
		try {
			await saveMutation.mutateAsync({ id: editing?.id ?? null, fields, reason });
			formOpen = false;
			toast.success(
				editing ? `Profil ${fields.name} diperbarui.` : `Profil ${fields.name} dibuat.`
			);
		} catch (error) {
			formError = error;
		}
	}

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
	const formFieldError = (key: string) => getFieldError(formError, key);
</script>

<AdminPageHeader
	title="Profil batas"
	crumbs={[{ label: 'Profil batas' }]}
	description="Paket batas yang bisa dipasang ke workspace, misalnya Pilot, Kelas, atau Magang. Perubahan berlaku untuk semua workspace yang memakainya."
>
	{#snippet actions()}
		<Button onclick={() => openForm(null)}>
			<Plus size={16} weight="bold" aria-hidden="true" />
			Buat profil
		</Button>
	{/snippet}
</AdminPageHeader>

<ListToolbar
	id="profiles"
	searchLabel="Cari nama profil"
	search={list.search}
	onSearch={(value) => url.update({ search: value }, { replace: true })}
	hasFilters={Boolean(list.search)}
	onReset={() => url.update({ search: null })}
/>

{#if query.isError && !query.data}
	<AdminError error={query.error} what="profil batas" onRetry={() => query.refetch()} />
{:else}
	<AdminTable
		caption="Daftar profil batas"
		columns={[
			{ label: 'Profil' },
			{ label: 'Proyek', class: 'text-right' },
			{ label: 'Container', class: 'text-right' },
			{ label: 'Deployment', class: 'text-right' },
			{ label: 'Memori', class: 'text-right' },
			{ label: 'CPU', class: 'text-right' },
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
					<td class="px-4 py-3 text-right tabular-nums">{formatNumber(profile.max_projects)}</td>
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
								aria-label={`Ubah ${profile.name}`}
								onclick={() => openForm(profile)}>Ubah</Button
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
{/if}

<ReasonDialog
	open={formOpen}
	id="profile-form"
	title={editing ? 'Ubah profil batas' : 'Buat profil batas'}
	subject={editing
		? `Profil ${editing.name}, dipakai ${formatNumber(editing.workspaces_count ?? 0)} workspace`
		: 'Profil baru'}
	consequence={editing
		? 'Batas baru langsung berlaku untuk semua workspace yang memakai profil ini. Yang sudah terlewati tidak dibatalkan.'
		: 'Profil baru belum dipakai siapa pun sampai kamu memasangnya ke workspace.'}
	confirmLabel={editing ? 'Simpan perubahan' : 'Buat profil'}
	error={formError}
	fieldsInvalid={formInvalid}
	onCancel={() => (formOpen = false)}
	onConfirm={save}
>
	{#snippet fields()}
		<div class="space-y-1.5">
			<label for="profile-name" class="block text-sm font-medium">Nama</label>
			<input
				id="profile-name"
				class="control-input"
				bind:value={name}
				maxlength="100"
				aria-invalid={formFieldError('name') ? 'true' : undefined}
				aria-describedby="profile-name-hint"
			/>
			<p
				id="profile-name-hint"
				class="text-xs {formFieldError('name') ? 'text-error-base' : 'text-foreground/70'}"
			>
				{formFieldError('name') ?? 'Unik, paling panjang 100 karakter.'}
			</p>
		</div>
		<div class="grid gap-3 sm:grid-cols-2">
			{#each NUMBER_FIELDS as field (field.key)}
				{@const problem = values[field.key] ? fieldProblem(field) : null}
				{@const message = formFieldError(field.key) ?? problem}
				<div class="space-y-1.5">
					<label for={`profile-${field.key}`} class="block text-sm font-medium">{field.label}</label
					>
					<input
						id={`profile-${field.key}`}
						type="number"
						inputmode="numeric"
						min={field.min}
						max={field.max}
						class="control-input"
						bind:value={values[field.key]}
						aria-invalid={message ? 'true' : undefined}
						aria-describedby={`profile-${field.key}-hint`}
					/>
					<p
						id={`profile-${field.key}-hint`}
						class="text-xs {message ? 'text-error-base' : 'text-foreground/70'}"
					>
						{message ?? field.hint}
					</p>
				</div>
			{/each}
		</div>
	{/snippet}
</ReasonDialog>

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

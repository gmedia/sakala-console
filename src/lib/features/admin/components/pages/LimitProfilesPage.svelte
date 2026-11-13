<script lang="ts">
	// Links here are resolve() output, some with a query string added, which the rule cannot follow.
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
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
	import { createAdminWorkspaceQuery, createLimitProfilesQuery } from '../../queries';
	import {
		createDeleteLimitProfileMutation,
		createSaveLimitProfileMutation
	} from '../../mutations';
	import { useListUrl } from '../../list-url.svelte';
	import { readListState, toApiParams } from '../../url-state';
	import { formatNumber, formatProfileIdleSleep } from '../../format';
	import { ASSIGN_PROFILE_PARAM, parseProfileReturn } from '../../return-to';
	import {
		IDLE_SLEEP_MINUTES_RANGE,
		profilePrefill,
		type ProfilePrefill
	} from '../../profile-defaults';

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
			hint: 'Proyek yang melayani atau sedang di-deploy sekaligus. Proyek yang tidur tidak dihitung.'
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
			hint: 'Boleh dikosongkan. API belum menegakkan batas ini; nilainya disimpan untuk nanti.',
			optional: true
		},
		{
			key: 'idle_sleep_minutes',
			label: 'Tidur otomatis (menit)',
			...IDLE_SLEEP_MINUTES_RANGE,
			hint: `Kosong berarti ikut bawaan server, 0 berarti proyek tidak pernah tidur, atau 1 sampai ${formatNumber(IDLE_SLEEP_MINUTES_RANGE.max)} menit tanpa pengunjung.`,
			optional: true
		}
	];

	let editing = $state<LimitProfile | null>(null);
	let formOpen = $state(false);
	let formError = $state<unknown>(null);
	let name = $state('');
	// A number input binds a number (or null when empty), never a string, so read it through rawValue.
	let values = $state<Record<NumberField, string | number | null>>({
		max_projects: '',
		max_active_containers: '',
		max_active_deployments: '',
		max_memory_mb: '',
		max_cpu_millis: '',
		max_builds_per_hour: '',
		idle_sleep_minutes: ''
	});

	let deleting = $state<LimitProfile | null>(null);
	let deleteError = $state<unknown>(null);

	// Which numbers a new profile started from, said in the form so nobody mistakes them for a rule.
	let prefill = $state<ProfilePrefill['source'] | null>(null);
	let numbersEdited = false;

	function applyPrefill(next: ProfilePrefill) {
		for (const [key, value] of Object.entries(next.numbers)) {
			values[key as NumberField] = String(value);
		}
		prefill = next.source;
	}

	function openForm(profile: LimitProfile | null) {
		editing = profile;
		formError = null;
		name = profile?.name ?? '';
		numbersEdited = false;
		prefill = null;
		for (const field of NUMBER_FIELDS) {
			values[field.key] = profile?.[field.key]?.toString() ?? '';
		}
		// A new profile starts from the team default instead of six empty boxes.
		if (!profile) applyPrefill(profilePrefill(returnWorkspace.data));
		formOpen = true;
	}

	function rawValue(key: NumberField): string {
		return String(values[key] ?? '').trim();
	}

	function fieldProblem(field: (typeof NUMBER_FIELDS)[number]): string | null {
		const raw = rawValue(field.key);
		if (!raw) {
			return field.optional
				? null
				: `Belum diisi. Isi bilangan bulat ${formatNumber(field.min)} sampai ${formatNumber(field.max)}.`;
		}
		const value = Number(raw);
		if (!Number.isInteger(value) || value < field.min || value > field.max) {
			return `Bilangan bulat ${formatNumber(field.min)} sampai ${formatNumber(field.max)}.`;
		}
		return null;
	}

	const nameProblem = $derived(name.trim() ? null : 'Nama belum diisi.');
	const formProblem = $derived.by(() => {
		const labels = [
			...(nameProblem ? ['Nama'] : []),
			...NUMBER_FIELDS.filter((field) => fieldProblem(field) !== null).map((field) => field.label)
		];
		return labels.length ? `Periksa isian yang ditandai: ${labels.join(', ')}.` : null;
	});

	// Opened from an assign dialog with no profiles yet: start on the create form, and once the
	// profile exists, go back to that workspace or user with the new profile chosen.
	const returnTarget = $derived(parseProfileReturn(url.search.get('return_to')));
	// The workspace a profile is being made for reports the live team default in its quota.
	const returnWorkspace = createAdminWorkspaceQuery(
		() => (returnTarget?.kind === 'workspaces' ? returnTarget.id : ''),
		() => returnTarget?.kind === 'workspaces'
	);
	// It may arrive after the form opened; take it as long as nobody has changed a number yet.
	$effect(() => {
		const live = profilePrefill(returnWorkspace.data);
		if (formOpen && !editing && prefill === 'documented' && live.source === 'workspace') {
			if (!numbersEdited) applyPrefill(live);
		}
	});
	let createLinkHandled = false;
	$effect(() => {
		if (url.search.get('create') !== '1' || createLinkHandled) return;
		createLinkHandled = true;
		openForm(null);
	});

	function closeForm() {
		formOpen = false;
		if (url.search.has('create') || url.search.has('return_to')) {
			url.update({ create: null, return_to: null }, { replace: true });
		}
	}

	async function save(reason: string) {
		formError = null;
		const numbers = Object.fromEntries(
			NUMBER_FIELDS.map((field) => {
				const raw = rawValue(field.key);
				return [field.key, raw ? Number(raw) : null];
			})
		) as Pick<LimitProfileFields, NumberField>;
		const fields: LimitProfileFields = { ...numbers, name: name.trim() };
		try {
			const saved = await saveMutation.mutateAsync({ id: editing?.id ?? null, fields, reason });
			const target = editing ? null : returnTarget;
			formOpen = false;
			if (target) {
				toast.success(`Profil ${fields.name} dibuat. Tulis alasan lalu simpan untuk memasangnya.`);
				const back =
					target.kind === 'workspaces'
						? resolve(`/admin/workspaces/${target.id}`)
						: resolve(`/admin/users/${target.id}`);
				await goto(`${back}?${ASSIGN_PROFILE_PARAM}=${encodeURIComponent(saved.id)}`);
				return;
			}
			toast.success(
				editing ? `Profil ${fields.name} diperbarui.` : `Profil ${fields.name} dibuat.`
			);
			closeForm();
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
			{ label: 'Tidur otomatis', class: 'text-right' },
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
					<td class="px-4 py-3 text-right whitespace-nowrap tabular-nums"
						>{formatProfileIdleSleep(profile.idle_sleep_minutes)}</td
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
		: returnTarget
			? `Profil baru belum dipakai siapa pun. Setelah dibuat, kamu kembali ke ${returnTarget.kind === 'workspaces' ? 'workspace' : 'pengguna'} tadi untuk memasangnya.`
			: 'Profil baru belum dipakai siapa pun sampai kamu memasangnya ke workspace.'}
	confirmLabel={editing ? 'Simpan perubahan' : 'Buat profil'}
	error={formError}
	fieldsProblem={formProblem}
	onCancel={closeForm}
	onConfirm={save}
>
	{#snippet fields({ showErrors })}
		{@const nameError = formFieldError('name') ?? (showErrors ? nameProblem : null)}
		<div class="space-y-1.5">
			<label for="profile-name" class="block text-sm font-medium">
				Nama <span class="font-normal text-foreground/70">(wajib)</span>
			</label>
			<input
				id="profile-name"
				class="control-input"
				bind:value={name}
				maxlength="100"
				aria-invalid={nameError ? 'true' : undefined}
				aria-describedby="profile-name-hint"
			/>
			<p
				id="profile-name-hint"
				class="text-xs {nameError ? 'text-error-base' : 'text-foreground/70'}"
			>
				{nameError ?? 'Unik, paling panjang 100 karakter.'}
			</p>
		</div>
		{#if prefill}
			<p class="rounded-control border border-border bg-background px-3 py-2 text-sm">
				{prefill === 'workspace'
					? 'Angka di bawah sudah diisi dengan batas Default tim yang berlaku di workspace tadi. Ubah yang perlu.'
					: 'Angka di bawah sudah diisi dengan batas default tim bawaan Sakala: 2 proyek, 2 container berjalan, 1 deployment berjalan, 512 MB, dan 1.000 millicore. Server bisa memakai angka lain lewat konfigurasi, jadi ubah yang perlu.'}
			</p>
		{/if}
		<div class="grid gap-3 sm:grid-cols-2">
			{#each NUMBER_FIELDS as field (field.key)}
				{@const problem = rawValue(field.key) || showErrors ? fieldProblem(field) : null}
				{@const message = formFieldError(field.key) ?? problem}
				<div class="space-y-1.5">
					<label for={`profile-${field.key}`} class="block text-sm font-medium">
						{field.label}
						<span class="font-normal text-foreground/70"
							>{field.optional ? '(opsional)' : '(wajib)'}</span
						>
					</label>
					<input
						id={`profile-${field.key}`}
						type="number"
						inputmode="numeric"
						min={field.min}
						max={field.max}
						class="control-input"
						bind:value={values[field.key]}
						required={!field.optional}
						oninput={() => (numbersEdited = true)}
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

<script lang="ts">
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { useCurrentUser } from '$lib/features/auth/queries';
	import AdminPageHeader from '../AdminPageHeader.svelte';
	import AdminError from '../AdminError.svelte';
	import AdminTable from '../AdminTable.svelte';
	import DescriptionList from '../DescriptionList.svelte';
	import ReasonDialog from '../ReasonDialog.svelte';
	import QuotaCard from '../QuotaCard.svelte';
	import AuditEventList from '../AuditEventList.svelte';
	import { createAdminUserQuery, createLimitProfileOptionsQuery } from '../../queries';
	import {
		createAssignLimitProfileMutation,
		createUserRoleMutation,
		createUserTeamLimitMutation
	} from '../../mutations';
	import {
		MEMBER_ROLE_LABELS,
		ROLE_LABELS,
		WORKSPACE_TYPE_LABELS,
		formatNumber,
		formatWibDateTime,
		onboardingSourceLabel
	} from '../../format';

	let { id }: { id: string } = $props();

	const query = createAdminUserQuery(() => id);
	const currentUser = useCurrentUser();
	const detail = $derived(query.data);
	const user = $derived(detail?.user);
	const isSelf = $derived(user !== undefined && currentUser.data?.id === user.id);

	const roleMutation = createUserRoleMutation();
	const teamLimitMutation = createUserTeamLimitMutation();
	const profileMutation = createAssignLimitProfileMutation();

	type DialogKind = 'role' | 'team-limit' | 'profile' | null;
	let dialog = $state<DialogKind>(null);
	let dialogError = $state<unknown>(null);

	let teamLimitDefault = $state(true);
	let teamLimitValue = $state('');
	let profileId = $state('');

	const profilesQuery = createLimitProfileOptionsQuery(() => dialog === 'profile');

	function open(kind: Exclude<DialogKind, null>) {
		dialogError = null;
		if (kind === 'team-limit') {
			teamLimitDefault = user?.max_owned_teams === null;
			teamLimitValue = user?.max_owned_teams?.toString() ?? '';
		}
		if (kind === 'profile') {
			profileId = detail?.personal_workspace_quota?.limit_profile?.id ?? '';
		}
		dialog = kind;
	}

	async function run(action: () => Promise<unknown>, success: string) {
		dialogError = null;
		try {
			await action();
			dialog = null;
			toast.success(success);
		} catch (error) {
			dialogError = error;
		}
	}

	const subject = $derived(user ? `${user.name} (@${user.username})` : '');
	const promoting = $derived(user?.role !== 'admin');
	const teamLimitInvalid = $derived(
		!teamLimitDefault &&
			!(
				/^\d+$/.test(teamLimitValue) &&
				Number(teamLimitValue) >= 0 &&
				Number(teamLimitValue) <= 1000
			)
	);
</script>

<AdminPageHeader
	title={user?.name ?? 'Pengguna'}
	documentTitle={user ? `${user.name} · Pengguna` : 'Pengguna'}
	crumbs={[{ label: 'Pengguna', href: resolve('/admin/users') }, { label: user?.name ?? '...' }]}
>
	{#if user}
		<div class="flex flex-wrap items-center gap-2 text-sm text-muted">
			<span>@{user.username}</span>
			<Badge tone={user.role === 'admin' ? 'running' : 'neutral'}
				>{ROLE_LABELS[user.role] ?? user.role}</Badge
			>
			{#if !user.email_verified}<Badge tone="warning">Email belum terverifikasi</Badge>{/if}
		</div>
	{/if}
	{#snippet actions()}
		{#if user}
			<Button variant="secondary" onclick={() => open('profile')}>Ubah profil batas</Button>
			<Button variant="secondary" onclick={() => open('team-limit')}>Ubah batas tim</Button>
			{#if promoting}
				<Button onclick={() => open('role')}>Jadikan admin</Button>
			{:else if !isSelf}
				<Button variant="danger" onclick={() => open('role')}>Cabut peran admin</Button>
			{/if}
		{/if}
	{/snippet}
</AdminPageHeader>

{#if query.isError}
	<AdminError error={query.error} what="pengguna" onRetry={() => query.refetch()} />
{:else if !detail || !user}
	<div class="skeleton h-64 w-full" role="status" aria-label="Sedang memuat"></div>
{:else}
	<div class="grid gap-6 lg:grid-cols-2">
		<section aria-labelledby="account-heading" class="flex min-w-0 flex-col gap-3">
			<h2 id="account-heading" class="text-base">Akun</h2>
			<DescriptionList
				items={[
					{ label: 'Email', value: user.email },
					{ label: 'Terdaftar', value: formatWibDateTime(user.created_at) },
					{
						label: 'Terakhir masuk',
						value: user.last_login_at ? formatWibDateTime(user.last_login_at) : 'Belum pernah'
					},
					{
						label: 'Onboarding',
						value: user.onboarding_completed_at
							? `Selesai ${formatWibDateTime(user.onboarding_completed_at)}`
							: 'Belum selesai'
					},
					{ label: 'Tahu Sakala dari', value: onboardingSourceLabel(user.onboarding_source) },
					{ label: 'Proyek yang dibuat', value: formatNumber(user.created_projects_count ?? 0) },
					{
						label: 'Tim yang dimiliki',
						value: `${formatNumber(detail.owned_teams_count)} dari ${detail.effective_max_owned_teams === null ? 'tanpa batas' : formatNumber(detail.effective_max_owned_teams)}${user.max_owned_teams === null ? ' (default)' : ''}`
					}
				]}
			/>
		</section>
		<section aria-labelledby="quota-heading" class="flex min-w-0 flex-col gap-3">
			<h2 id="quota-heading" class="text-base">Batas workspace pribadi</h2>
			{#if detail.personal_workspace_quota}
				<QuotaCard quota={detail.personal_workspace_quota} defaultLabel="Default pribadi" />
			{:else}
				<p class="surface-card p-5 text-sm text-muted">Akun ini belum punya workspace pribadi.</p>
			{/if}
		</section>
	</div>

	<section aria-labelledby="workspaces-heading" class="mt-8 flex flex-col gap-3">
		<h2 id="workspaces-heading" class="text-base">Workspace</h2>
		<AdminTable
			caption="Workspace pengguna ini"
			columns={[
				{ label: 'Workspace' },
				{ label: 'Tipe' },
				{ label: 'Peran' },
				{ label: 'Proyek', class: 'text-right' },
				{ label: 'Profil batas' }
			]}
			empty={detail.workspaces.length === 0}
			emptyTitle="Belum ada workspace"
		>
			{#snippet rows()}
				{#each detail.workspaces as workspace (workspace.id)}
					<tr>
						<td class="px-4 py-3">
							<a
								href={resolve(`/admin/workspaces/${workspace.id}`)}
								class="inline-flex min-h-6 items-center font-medium underline underline-offset-2"
								>{workspace.name}</a
							>
							<p class="text-xs text-muted">{workspace.slug}</p>
						</td>
						<td class="px-4 py-3">{WORKSPACE_TYPE_LABELS[workspace.type] ?? workspace.type}</td>
						<td class="px-4 py-3"
							>{workspace.role ? (MEMBER_ROLE_LABELS[workspace.role] ?? workspace.role) : '-'}</td
						>
						<td class="px-4 py-3 text-right tabular-nums"
							>{formatNumber(workspace.projects_count)}</td
						>
						<td class="px-4 py-3">{workspace.limit_profile?.name ?? 'Default'}</td>
					</tr>
				{/each}
			{/snippet}
		</AdminTable>
	</section>

	<section aria-labelledby="audit-heading" class="mt-8 flex flex-col gap-3">
		<h2 id="audit-heading" class="text-base">Aktivitas terbaru</h2>
		<p class="text-sm text-muted">
			20 audit event terbaru tempat akun ini menjadi pelaku atau subjek.
		</p>
		<AuditEventList events={detail.recent_audit_events} />
	</section>

	<ReasonDialog
		open={dialog === 'role'}
		id="user-role"
		title={promoting ? 'Jadikan admin?' : 'Cabut peran admin?'}
		{subject}
		consequence={promoting
			? 'Akun ini bisa membuka area admin: melihat semua pengguna dan proyek, menghentikan atau menangguhkan proyek, dan mengatur batas.'
			: 'Akun ini kehilangan akses ke area admin di permintaan berikutnya. Proyek dan workspace-nya tidak berubah.'}
		confirmLabel={promoting ? 'Jadikan admin' : 'Cabut peran admin'}
		variant={promoting ? 'default' : 'destructive'}
		error={dialogError}
		onCancel={() => (dialog = null)}
		onConfirm={(reason) =>
			run(
				() => roleMutation.mutateAsync({ id: user.id, role: promoting ? 'admin' : 'user', reason }),
				promoting ? `${user.name} sekarang admin.` : `Peran admin ${user.name} dicabut.`
			)}
	/>

	<ReasonDialog
		open={dialog === 'team-limit'}
		id="user-team-limit"
		title="Ubah batas tim"
		{subject}
		consequence={`Berapa tim yang boleh dimiliki akun ini sebagai owner. Sekarang ${formatNumber(detail.owned_teams_count)} tim. Batas di bawah itu hanya menahan tim baru, tim yang ada tetap.`}
		confirmLabel="Simpan batas"
		error={dialogError}
		fieldsInvalid={teamLimitInvalid}
		onCancel={() => (dialog = null)}
		onConfirm={(reason) =>
			run(
				() =>
					teamLimitMutation.mutateAsync({
						id: user.id,
						max_owned_teams: teamLimitDefault ? null : Number(teamLimitValue),
						reason
					}),
				'Batas tim disimpan.'
			)}
	>
		{#snippet fields()}
			<label class="flex items-center gap-3 text-sm font-medium">
				<input type="checkbox" class="size-5" bind:checked={teamLimitDefault} />
				Pakai batas default dari konfigurasi
			</label>
			{#if !teamLimitDefault}
				<div class="space-y-1.5">
					<label for="team-limit-value" class="block text-sm font-medium">Jumlah tim maksimal</label
					>
					<input
						id="team-limit-value"
						type="number"
						min="0"
						max="1000"
						inputmode="numeric"
						class="control-input"
						bind:value={teamLimitValue}
						aria-invalid={teamLimitInvalid ? 'true' : undefined}
						aria-describedby="team-limit-hint"
					/>
					<p
						id="team-limit-hint"
						class="text-xs {teamLimitInvalid ? 'text-error-base' : 'text-foreground/70'}"
					>
						0 sampai 1000.
					</p>
				</div>
			{/if}
		{/snippet}
	</ReasonDialog>

	<ReasonDialog
		open={dialog === 'profile'}
		id="user-profile"
		title="Ubah profil batas"
		subject={`Workspace pribadi ${subject}`}
		consequence="Batas baru langsung berlaku. Batas yang sudah terlewati tidak dibatalkan; batas yang lebih rendah hanya menahan proyek dan deployment baru."
		confirmLabel="Simpan profil"
		error={dialogError}
		fieldsInvalid={profilesQuery.isPending}
		onCancel={() => (dialog = null)}
		onConfirm={(reason) =>
			run(
				() =>
					profileMutation.mutateAsync({
						target: { kind: 'user', id: user.id },
						limit_profile_id: profileId || null,
						reason
					}),
				'Profil batas disimpan.'
			)}
	>
		{#snippet fields()}
			<div class="space-y-1.5">
				<label for="user-profile-select" class="block text-sm font-medium">Profil batas</label>
				<select
					id="user-profile-select"
					class="control-input cursor-pointer"
					bind:value={profileId}
					disabled={profilesQuery.isPending}
				>
					<option value="">Default pribadi</option>
					{#each profilesQuery.data?.data ?? [] as profile (profile.id)}
						<option value={profile.id}>{profile.name}</option>
					{/each}
				</select>
				{#if profilesQuery.isError}
					<p class="text-xs text-error-base" role="alert">Daftar profil batas gagal dimuat.</p>
				{/if}
			</div>
		{/snippet}
	</ReasonDialog>
{/if}

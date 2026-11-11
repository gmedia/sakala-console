<script lang="ts">
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import AdminPageHeader from '../AdminPageHeader.svelte';
	import AdminError from '../AdminError.svelte';
	import AdminTable from '../AdminTable.svelte';
	import ReasonDialog from '../ReasonDialog.svelte';
	import QuotaCard from '../QuotaCard.svelte';
	import { createAdminWorkspaceQuery, createLimitProfileOptionsQuery } from '../../queries';
	import { createAssignLimitProfileMutation } from '../../mutations';
	import {
		MEMBER_ROLE_LABELS,
		WORKSPACE_TYPE_LABELS,
		formatWibDate,
		projectStatus,
		runtimeStatus
	} from '../../format';

	let { id }: { id: string } = $props();

	const query = createAdminWorkspaceQuery(() => id);
	const detail = $derived(query.data);
	const workspace = $derived(detail?.workspace);

	const mutation = createAssignLimitProfileMutation();
	let dialogOpen = $state(false);
	let dialogError = $state<unknown>(null);
	let profileId = $state('');
	const profilesQuery = createLimitProfileOptionsQuery(() => dialogOpen);

	function openDialog() {
		dialogError = null;
		profileId = workspace?.limit_profile?.id ?? '';
		dialogOpen = true;
	}

	async function save(reason: string) {
		if (!workspace) return;
		dialogError = null;
		try {
			await mutation.mutateAsync({
				target: { kind: 'workspace', id: workspace.id },
				limit_profile_id: profileId || null,
				reason
			});
			dialogOpen = false;
			toast.success('Profil batas disimpan.');
		} catch (error) {
			dialogError = error;
		}
	}

	const defaultLabel = $derived(workspace?.type === 'team' ? 'Default tim' : 'Default pribadi');
</script>

<AdminPageHeader
	title={workspace?.name ?? 'Workspace'}
	documentTitle={workspace ? `${workspace.name} · Workspace` : 'Workspace'}
	crumbs={[
		{ label: 'Workspace', href: resolve('/admin/workspaces') },
		{ label: workspace?.name ?? '...' }
	]}
>
	{#if workspace}
		<div class="flex flex-wrap items-center gap-2 text-sm text-muted">
			<span>{workspace.slug}</span>
			<Badge tone={workspace.type === 'team' ? 'running' : 'neutral'}
				>{WORKSPACE_TYPE_LABELS[workspace.type] ?? workspace.type}</Badge
			>
			{#if workspace.personal_user}
				<a
					href={resolve(`/admin/users/${String(workspace.personal_user.id)}`)}
					class="inline-flex min-h-6 items-center underline underline-offset-2"
					>Milik @{workspace.personal_user.username}</a
				>
			{/if}
		</div>
	{/if}
	{#snippet actions()}
		{#if workspace}<Button onclick={openDialog}>Ubah profil batas</Button>{/if}
	{/snippet}
</AdminPageHeader>

{#if query.isError}
	<AdminError error={query.error} what="workspace" onRetry={() => query.refetch()} />
{:else if !detail || !workspace}
	<div class="skeleton h-64 w-full" role="status" aria-label="Sedang memuat"></div>
{:else}
	<div class="grid gap-6 lg:grid-cols-3">
		<section aria-labelledby="ws-quota" class="flex min-w-0 flex-col gap-3">
			<h2 id="ws-quota" class="text-base">Batas dan pemakaian</h2>
			<QuotaCard quota={detail.quota} {defaultLabel} />
		</section>
		<section aria-labelledby="ws-members" class="flex min-w-0 flex-col gap-3 lg:col-span-2">
			<h2 id="ws-members" class="text-base">Anggota</h2>
			<AdminTable
				caption="Anggota workspace"
				columns={[
					{ label: 'Nama' },
					{ label: 'Email' },
					{ label: 'Peran' },
					{ label: 'Bergabung' }
				]}
				empty={detail.members.length === 0}
				emptyTitle="Belum ada anggota"
			>
				{#snippet rows()}
					{#each detail.members as member (member.id)}
						<tr>
							<td class="px-4 py-3">
								<a
									href={resolve(`/admin/users/${String(member.user.id)}`)}
									class="inline-flex min-h-6 items-center font-medium underline underline-offset-2"
									>{member.user.name}</a
								>
								<p class="text-xs text-muted">@{member.user.username}</p>
							</td>
							<td class="px-4 py-3 wrap-anywhere">{member.user.email}</td>
							<td class="px-4 py-3">{MEMBER_ROLE_LABELS[member.role] ?? member.role}</td>
							<td class="px-4 py-3 whitespace-nowrap">{formatWibDate(member.joined_at)}</td>
						</tr>
					{/each}
				{/snippet}
			</AdminTable>
		</section>
	</div>

	<section aria-labelledby="ws-projects" class="mt-8 flex flex-col gap-3">
		<h2 id="ws-projects" class="text-base">Proyek</h2>
		<AdminTable
			caption="Proyek workspace"
			columns={[
				{ label: 'Proyek' },
				{ label: 'Runtime' },
				{ label: 'Status' },
				{ label: 'Dibuat' }
			]}
			empty={detail.projects.length === 0}
			emptyTitle="Workspace ini belum punya proyek"
		>
			{#snippet rows()}
				{#each detail.projects as project (project.id)}
					{@const runtime = runtimeStatus(project.runtime_status)}
					{@const status = projectStatus(project.status)}
					<tr>
						<td class="px-4 py-3">
							<a
								href={resolve(`/admin/projects/${project.id}`)}
								class="inline-flex min-h-6 items-center font-medium underline underline-offset-2"
								>{project.name}</a
							>
							<p class="text-xs text-muted">{project.slug}</p>
						</td>
						<td class="px-4 py-3"><Badge tone={runtime.tone}>{runtime.label}</Badge></td>
						<td class="px-4 py-3"><Badge tone={status.tone}>{status.label}</Badge></td>
						<td class="px-4 py-3 whitespace-nowrap">{formatWibDate(project.created_at)}</td>
					</tr>
				{/each}
			{/snippet}
		</AdminTable>
	</section>

	<ReasonDialog
		open={dialogOpen}
		id="workspace-profile"
		title="Ubah profil batas"
		subject={`Workspace ${workspace.name}`}
		consequence="Batas baru langsung berlaku untuk semua anggota. Yang sudah terlewati tidak dibatalkan; batas yang lebih rendah hanya menahan proyek dan deployment baru."
		confirmLabel="Simpan profil"
		error={dialogError}
		fieldsInvalid={profilesQuery.isPending}
		onCancel={() => (dialogOpen = false)}
		onConfirm={save}
	>
		{#snippet fields()}
			<div class="space-y-1.5">
				<label for="workspace-profile-select" class="block text-sm font-medium">Profil batas</label>
				<select
					id="workspace-profile-select"
					class="control-input cursor-pointer"
					bind:value={profileId}
					disabled={profilesQuery.isPending}
				>
					<option value="">{defaultLabel}</option>
					{#each profilesQuery.data?.data ?? [] as profile (profile.id)}
						<option value={profile.id}>{profile.name}</option>
					{/each}
				</select>
			</div>
		{/snippet}
	</ReasonDialog>
{/if}

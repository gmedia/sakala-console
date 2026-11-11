<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import UserPlus from 'phosphor-svelte/lib/UserPlus';
	import UsersThree from 'phosphor-svelte/lib/UsersThree';
	import type { WorkspaceInvitation, WorkspaceMember } from '$lib/api/resources/workspaces';
	import EmptyState from '$lib/components/feedback/EmptyState.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import { useCurrentUser } from '$lib/features/auth/queries';
	import { formatDate } from '$lib/utils/date';
	import { useActiveWorkspace } from '../access.svelte';
	import {
		createDeleteWorkspaceMutation,
		createLeaveWorkspaceMutation,
		createRevokeInvitationMutation
	} from '../mutations';
	import {
		ROLE_DESCRIPTIONS,
		ROLE_LABELS,
		canManageWorkspace,
		deleteGuard,
		leaveGuard,
		limitsWorkspaceId,
		memberGuard,
		workspaceErrorMessage
	} from '../presentation';
	import {
		createWorkspaceInvitationsQuery,
		createWorkspaceLimitsQuery,
		createWorkspaceMembersQuery
	} from '../queries';
	import ChangeRoleDialog from './ChangeRoleDialog.svelte';
	import CreateWorkspaceDialog from './CreateWorkspaceDialog.svelte';
	import InviteMemberDialog from './InviteMemberDialog.svelte';
	import RemoveMemberDialog from './RemoveMemberDialog.svelte';
	import RenameWorkspaceForm from './RenameWorkspaceForm.svelte';
	import WorkspaceLimits from './WorkspaceLimits.svelte';

	let { workspaceId }: { workspaceId: string } = $props();

	const userQuery = useCurrentUser();
	const workspaces = useActiveWorkspace();
	const workspace = $derived(workspaces.workspaces.find((item) => item.id === workspaceId) ?? null);
	const isTeam = $derived(workspace?.type === 'team');
	const isOwner = $derived(canManageWorkspace(workspace?.role));

	const membersQuery = createWorkspaceMembersQuery(() => (isTeam ? workspaceId : null));
	const invitationsQuery = createWorkspaceInvitationsQuery(
		() => workspaceId,
		() => isTeam && isOwner
	);
	const limitsQuery = createWorkspaceLimitsQuery(
		() => limitsWorkspaceId(workspace),
		() => ({
			enabled: Boolean(workspace)
		})
	);

	const members = $derived(membersQuery.data ?? []);
	const invitations = $derived(invitationsQuery.data ?? []);
	const myId = $derived(userQuery.data?.id);
	const leaveBlocked = $derived(leaveGuard(workspace?.role, members));
	const deleteBlocked = $derived(deleteGuard(limitsQuery.data?.quotas.current_projects_count));

	let inviteOpen = $state(false);
	let createOpen = $state(false);
	let roleTarget = $state<WorkspaceMember | null>(null);
	let roleOpen = $state(false);
	let removeTarget = $state<WorkspaceMember | null>(null);
	let removeOpen = $state(false);
	let revokeTarget = $state<WorkspaceInvitation | null>(null);
	let revokeOpen = $state(false);
	let leaveOpen = $state(false);
	let deleteOpen = $state(false);
	let lastTrigger: HTMLElement | null = null;

	const revokeMutation = createRevokeInvitationMutation(() => workspaceId);
	const leaveMutation = createLeaveWorkspaceMutation();
	const deleteMutation = createDeleteWorkspaceMutation();

	let revokeError = $state<string | null>(null);
	let leaveError = $state<string | null>(null);
	let deleteError = $state<string | null>(null);
	let busy = false;

	function remember(event: Event) {
		lastTrigger = event.currentTarget as HTMLElement;
	}

	function openRole(event: Event, member: WorkspaceMember) {
		remember(event);
		roleTarget = member;
		roleOpen = true;
	}

	function openRemove(event: Event, member: WorkspaceMember) {
		remember(event);
		removeTarget = member;
		removeOpen = true;
	}

	function openRevoke(event: Event, invitation: WorkspaceInvitation) {
		remember(event);
		revokeTarget = invitation;
		revokeError = null;
		revokeOpen = true;
	}

	const isExpired = (invitation: WorkspaceInvitation) =>
		new Date(invitation.expires_at).getTime() <= Date.now();

	async function handleRevoke() {
		if (busy || !revokeTarget) return;
		busy = true;
		revokeError = null;
		try {
			await revokeMutation.mutateAsync(revokeTarget.id);
			revokeOpen = false;
			toast.success(`Undangan untuk ${revokeTarget.email} dibatalkan.`);
		} catch (error) {
			revokeError = workspaceErrorMessage(error, 'Undangan belum bisa dibatalkan.');
		} finally {
			busy = false;
		}
	}

	// Leaving or deleting ends access here, so the personal workspace takes over.
	function backToPersonal() {
		const personal = workspaces.workspaces.find((item) => item.type === 'personal');
		if (personal) workspaces.select(personal.id);
		void goto(resolve('/projects'));
	}

	async function handleLeave() {
		if (busy || !workspace) return;
		busy = true;
		leaveError = null;
		const name = workspace.name;
		try {
			await leaveMutation.mutateAsync(workspaceId);
			leaveOpen = false;
			toast.success(`Kamu sudah keluar dari ${name}.`);
			backToPersonal();
		} catch (error) {
			leaveError = workspaceErrorMessage(error, 'Kamu belum bisa keluar dari workspace ini.');
		} finally {
			busy = false;
		}
	}

	async function handleDelete() {
		if (busy || !workspace) return;
		busy = true;
		deleteError = null;
		const name = workspace.name;
		try {
			await deleteMutation.mutateAsync(workspaceId);
			deleteOpen = false;
			toast.success(`Workspace ${name} dihapus.`);
			backToPersonal();
		} catch (error) {
			deleteError = workspaceErrorMessage(error, 'Workspace belum bisa dihapus.');
		} finally {
			busy = false;
		}
	}

	const initials = (name: string) =>
		name
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase() ?? '')
			.join('');
</script>

{#snippet errorNote(message: string | null)}
	{#if message}
		<p
			role="alert"
			class="rounded-control border border-error/20 bg-error/10 px-3 py-2 text-sm text-foreground"
		>
			{message}
		</p>
	{/if}
{/snippet}

{#if !workspaces.isSettled}
	<div class="flex flex-col gap-4" role="status" aria-label="Memuat workspace">
		<div class="skeleton h-10 w-1/3"></div>
		<div class="skeleton h-40 w-full"></div>
	</div>
{:else if !workspace}
	<EmptyState
		icon={UsersThree}
		tone="muted"
		title="Workspace tidak ditemukan"
		description="Workspace ini mungkin sudah dihapus, atau kamu bukan anggotanya lagi."
	>
		{#snippet action()}
			<Button href={resolve('/projects')} variant="secondary">Kembali ke proyek</Button>
		{/snippet}
	</EmptyState>
{:else if workspace.type === 'personal'}
	<EmptyState
		icon={UsersThree}
		title="Workspace pribadi tidak punya anggota"
		description="Proyek di workspace pribadi hanya bisa dibuka olehmu. Buat workspace tim untuk mengerjakan proyek bersama orang lain."
	>
		{#snippet action()}
			<Button onclick={() => (createOpen = true)}>Buat workspace tim</Button>
		{/snippet}
	</EmptyState>
	<CreateWorkspaceDialog bind:open={createOpen} />
{:else}
	<div class="flex max-w-page flex-col gap-6 pb-12">
		<section class="flex flex-wrap items-start justify-between gap-4">
			<div class="min-w-0">
				<h2 class="font-display text-2xl font-semibold wrap-anywhere text-foreground">
					{workspace.name}
				</h2>
				<p class="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
					<span>Workspace tim</span>
					<span aria-hidden="true">·</span>
					<span
						>Peranmu: <strong class="font-medium text-foreground"
							>{ROLE_LABELS[workspace.role]}</strong
						></span
					>
				</p>
			</div>
			{#if isOwner}
				<Button onclick={() => (inviteOpen = true)}>
					<UserPlus size={16} aria-hidden="true" />
					Undang anggota
				</Button>
			{/if}
		</section>

		{#if workspace.role === 'viewer'}
			<p
				class="rounded-control border border-info/20 bg-info/10 p-3 text-sm text-foreground"
				data-testid="viewer-note"
			>
				Kamu pengamat di workspace ini. {ROLE_DESCRIPTIONS.viewer}
			</p>
		{/if}

		<WorkspaceLimits limits={limitsQuery.data} isLoading={limitsQuery.isPending} />

		<section class="surface-card flex flex-col gap-4 p-4 sm:p-6" aria-labelledby="members-heading">
			<div class="flex flex-wrap items-center justify-between gap-2">
				<h3 id="members-heading" class="text-base font-semibold text-foreground">
					Anggota{members.length ? ` (${members.length})` : ''}
				</h3>
			</div>

			{#if membersQuery.isPending}
				<div class="skeleton h-24 w-full" role="status" aria-label="Memuat anggota"></div>
			{:else if membersQuery.isError}
				<div class="flex flex-wrap items-center gap-3" role="alert">
					<p class="text-sm text-error">
						{workspaceErrorMessage(membersQuery.error, 'Daftar anggota belum bisa dimuat.')}
					</p>
					<Button variant="secondary" size="sm" onclick={() => membersQuery.refetch()}
						>Coba lagi</Button
					>
				</div>
			{:else}
				<ul class="divide-y divide-border border-t border-border" data-testid="member-list">
					{#each members as member (member.id)}
						{@const guard = memberGuard(member, members)}
						{@const isSelf = member.user.id === myId}
						<li class="flex flex-wrap items-center gap-3 py-3" data-testid="member-row">
							{#if member.user.avatar_url}
								<img
									src={member.user.avatar_url}
									alt=""
									class="size-9 shrink-0 rounded-full object-cover ring-1 ring-border"
								/>
							{:else}
								<span
									class="flex size-9 shrink-0 items-center justify-center rounded-full bg-background-soft text-sm font-semibold text-foreground"
									aria-hidden="true"
								>
									{initials(member.user.name)}
								</span>
							{/if}
							<div class="flex min-w-0 flex-1 basis-48 flex-col">
								<span class="truncate text-sm font-medium text-foreground">
									{member.user.name}
									{#if isSelf}<span class="font-normal text-muted">(kamu)</span>{/if}
								</span>
								<span class="truncate text-xs text-muted">
									@{member.user.username}{member.user.email ? ` · ${member.user.email}` : ''}
								</span>
							</div>
							<Badge tone={member.role === 'owner' ? 'running' : 'neutral'}>
								{ROLE_LABELS[member.role]}
							</Badge>
							{#if isOwner}
								<div class="flex gap-2">
									<Button
										variant="secondary"
										size="sm"
										aria-label={`Ubah peran ${member.user.name}`}
										onclick={(event) => openRole(event, member)}
									>
										Ubah peran
									</Button>
									{#if !isSelf}
										<Button
											variant="secondary"
											size="sm"
											disabled={guard.isLastOwner}
											aria-label={`Keluarkan ${member.user.name}`}
											title={guard.reason ?? undefined}
											onclick={(event) => openRemove(event, member)}
										>
											Keluarkan
										</Button>
									{/if}
								</div>
							{/if}
							{#if isOwner && guard.isLastOwner}
								<p class="basis-full text-xs text-muted" data-testid="last-owner-note">
									{isSelf
										? 'Kamu satu-satunya pemilik. Jadikan anggota lain pemilik dulu sebelum menurunkan peranmu atau keluar.'
										: guard.reason}
								</p>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		{#if isOwner}
			<section
				class="surface-card flex flex-col gap-4 p-4 sm:p-6"
				aria-labelledby="invitations-heading"
			>
				<h3 id="invitations-heading" class="text-base font-semibold text-foreground">
					Undangan tertunda
				</h3>
				{#if invitationsQuery.isPending}
					<div class="skeleton h-16 w-full" role="status" aria-label="Memuat undangan"></div>
				{:else if invitationsQuery.isError}
					<div class="flex flex-wrap items-center gap-3" role="alert">
						<p class="text-sm text-error">
							{workspaceErrorMessage(invitationsQuery.error, 'Undangan belum bisa dimuat.')}
						</p>
						<Button variant="secondary" size="sm" onclick={() => invitationsQuery.refetch()}>
							Coba lagi
						</Button>
					</div>
				{:else if invitations.length === 0}
					<p class="text-sm text-muted">
						Belum ada undangan yang menunggu. Undangan yang diterima langsung pindah ke daftar
						anggota.
					</p>
				{:else}
					<ul class="divide-y divide-border border-t border-border" data-testid="invitation-list">
						{#each invitations as invitation (invitation.id)}
							{@const expired = isExpired(invitation)}
							<li class="flex flex-wrap items-center gap-3 py-3" data-testid="invitation-row">
								<div class="flex min-w-0 flex-1 basis-48 flex-col">
									<span class="truncate text-sm font-medium text-foreground"
										>{invitation.email}</span
									>
									<span class="text-xs text-muted">
										{ROLE_LABELS[invitation.role]}
										{#if invitation.invited_by}· diundang {invitation.invited_by.name}{/if}
										·
										<time
											datetime={invitation.expires_at}
											title={formatDate(invitation.expires_at)}
										>
											{expired
												? 'kedaluwarsa'
												: `berlaku sampai ${formatDate(invitation.expires_at)}`}
										</time>
									</span>
								</div>
								{#if expired}
									<Badge tone="warning">Kedaluwarsa</Badge>
								{/if}
								<Button
									variant="secondary"
									size="sm"
									aria-label={`Batalkan undangan untuk ${invitation.email}`}
									onclick={(event) => openRevoke(event, invitation)}
								>
									{expired ? 'Hapus' : 'Batalkan'}
								</Button>
							</li>
						{/each}
					</ul>
					<p class="text-xs text-muted">
						Undangan yang kedaluwarsa tidak bisa dipakai. Undang emailnya lagi untuk mengirim tautan
						baru.
					</p>
				{/if}
			</section>

			<RenameWorkspaceForm {workspace} />

			<section class="surface-card flex flex-col gap-3 p-4 sm:p-6" aria-labelledby="delete-heading">
				<h3 id="delete-heading" class="text-base font-semibold text-foreground">Hapus workspace</h3>
				<p class="text-sm text-muted">
					Workspace hanya bisa dihapus kalau sudah tidak punya proyek. Anggota dan undangannya ikut
					hilang.
				</p>
				{#if deleteBlocked}
					<p class="text-sm text-foreground" data-testid="delete-blocked">{deleteBlocked}</p>
				{/if}
				<div>
					<Button
						variant="danger"
						disabled={Boolean(deleteBlocked)}
						onclick={(event) => {
							remember(event);
							deleteError = null;
							deleteOpen = true;
						}}
					>
						Hapus workspace
					</Button>
				</div>
			</section>
		{/if}

		<section class="surface-card flex flex-col gap-3 p-4 sm:p-6" aria-labelledby="leave-heading">
			<h3 id="leave-heading" class="text-base font-semibold text-foreground">
				Keluar dari workspace
			</h3>
			<p class="text-sm text-muted">
				Kamu langsung kehilangan akses ke proyek di workspace ini. Proyek yang kamu buat tetap milik
				workspace.
			</p>
			{#if leaveBlocked}
				<p class="text-sm text-foreground" data-testid="leave-blocked">{leaveBlocked}</p>
			{/if}
			<div>
				<Button
					variant="secondary"
					disabled={Boolean(leaveBlocked)}
					onclick={(event) => {
						remember(event);
						leaveError = null;
						leaveOpen = true;
					}}
				>
					Keluar dari workspace
				</Button>
			</div>
		</section>
	</div>

	{#if isOwner}
		<InviteMemberDialog bind:open={inviteOpen} {workspaceId} workspaceName={workspace.name} />
		<ChangeRoleDialog
			bind:open={roleOpen}
			{workspaceId}
			member={roleTarget}
			isLastOwner={roleTarget ? memberGuard(roleTarget, members).isLastOwner : false}
			isSelf={roleTarget?.user.id === myId}
			returnFocus={() => lastTrigger}
		/>
		<RemoveMemberDialog
			bind:open={removeOpen}
			{workspaceId}
			workspaceName={workspace.name}
			member={removeTarget}
			returnFocus={() => lastTrigger}
		/>
		<Dialog
			bind:open={revokeOpen}
			variant="destructive"
			title="Batalkan undangan?"
			confirmLabel={revokeMutation.isPending ? 'Membatalkan...' : 'Batalkan undangan'}
			cancelLabel="Kembali"
			loading={revokeMutation.isPending}
			returnFocus={() => lastTrigger}
			onConfirm={handleRevoke}
		>
			<div class="flex flex-col gap-3 text-sm text-foreground">
				<p>
					Tautan yang dikirim ke {revokeTarget?.email ?? 'email ini'} tidak bisa dipakai lagi. Kamu bisa
					mengundangnya lagi kapan saja.
				</p>
				{@render errorNote(revokeError)}
			</div>
		</Dialog>
		<Dialog
			bind:open={deleteOpen}
			variant="destructive"
			title={`Hapus ${workspace.name}?`}
			confirmLabel={deleteMutation.isPending ? 'Menghapus...' : 'Hapus workspace'}
			loading={deleteMutation.isPending}
			returnFocus={() => lastTrigger}
			onConfirm={handleDelete}
		>
			<div class="flex flex-col gap-3 text-sm text-foreground">
				<p>
					Semua anggota kehilangan akses dan undangan yang tertunda dibatalkan. Ini tidak bisa
					dibatalkan.
				</p>
				{@render errorNote(deleteError)}
			</div>
		</Dialog>
	{/if}

	<Dialog
		bind:open={leaveOpen}
		variant="destructive"
		title={`Keluar dari ${workspace.name}?`}
		confirmLabel={leaveMutation.isPending ? 'Keluar...' : 'Keluar'}
		cancelLabel="Tetap di sini"
		loading={leaveMutation.isPending}
		returnFocus={() => lastTrigger}
		onConfirm={handleLeave}
	>
		<div class="flex flex-col gap-3 text-sm text-foreground">
			<p>
				Kamu langsung kehilangan akses ke proyek di workspace ini. Untuk kembali, kamu perlu
				undangan baru.
			</p>
			{@render errorNote(leaveError)}
		</div>
	</Dialog>
{/if}

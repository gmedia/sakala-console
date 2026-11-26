<script lang="ts">
	// The create link carries the project in the query string, which resolve() cannot express.
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { page } from '$app/state';
	import Memory from 'phosphor-svelte/lib/Memory';
	import Plus from 'phosphor-svelte/lib/Plus';
	import EmptyState from '$lib/components/feedback/EmptyState.svelte';
	import ErrorBlock from '$lib/components/feedback/ErrorBlock.svelte';
	import ListPageLayout from '$lib/components/layout/templates/ListPageLayout.svelte';
	import { buttonClasses } from '$lib/components/ui/button-classes';
	import { useCurrentUser } from '$lib/features/auth/queries';
	import { isAdmin } from '$lib/features/admin/access';
	import { workspacePhrase } from '$lib/features/databases/presentation';
	import { createProjectQuery } from '$lib/features/projects/queries';
	import { useActiveWorkspace } from '$lib/features/workspaces/access.svelte';
	import { limitsWorkspaceId } from '$lib/features/workspaces/presentation';
	import { createWorkspaceLimitsQuery } from '$lib/features/workspaces/queries';
	import { valkeyAccess } from '../access';
	import {
		VALKEY_COPY,
		valkeyErrorMessage,
		valkeyQuota,
		valkeySizes,
		valkeysEnabled,
		valkeysUnavailable
	} from '../presentation';
	import { createValkeysQuery } from '../queries';
	import { VALKEY_PROJECT_PARAM, newValkeyHref } from '../routes';
	import ValkeyList from './ValkeyList.svelte';
	import ValkeyQuotaSummary from './ValkeyQuotaSummary.svelte';

	const userQuery = useCurrentUser();
	const workspaces = useActiveWorkspace();
	const active = $derived(workspaces.active);
	const siteAdmin = $derived(isAdmin(userQuery.data));
	const access = $derived(valkeyAccess(active?.role, siteAdmin));

	const limitsQuery = createWorkspaceLimitsQuery(
		() => limitsWorkspaceId(active),
		() => ({ enabled: Boolean(active) })
	);
	const limits = $derived(limitsQuery.data);
	// While the server's flag is off every Valkey endpoint answers 404: ask only once it is on.
	const enabled = $derived(valkeysEnabled(limits));
	const valkeysQuery = createValkeysQuery(
		() => active?.id ?? null,
		() => ({ enabled })
	);

	const quota = $derived(valkeyQuota(limits?.quotas, Math.min(...valkeySizes(limits))));
	const unavailable = $derived(valkeysUnavailable(limits));
	// The workspace was never opened for Valkey: a quiet note, not an invitation to create.
	const closed = $derived(!siteAdmin && quota?.count.max === 0);
	const canCreate = $derived(access.canManage && !unavailable && !closed);
	const blockedReason = $derived(siteAdmin ? null : (quota?.blockedReason ?? null));
	// A full quota is explained in the quota card, so the create link simply is not there.
	const canStart = $derived(canCreate && !blockedReason);

	// "Pilih atau buat Valkey" on a project links here with the project.
	const projectId = $derived(page.url.searchParams.get(VALKEY_PROJECT_PARAM));
	const projectQuery = createProjectQuery(() => projectId ?? '');
	const project = $derived(
		projectQuery.data && projectQuery.data.workspace?.id === active?.id ? projectQuery.data : null
	);
	const projectValkey = $derived(project?.valkeys?.[0] ?? null);
	const projectName = $derived(project?.name ?? project?.project_name ?? '');

	const valkeys = $derived(valkeysQuery.data ?? []);
	const workspaceName = $derived(workspacePhrase(active));
	const createHref = $derived(
		newValkeyHref({ projectId: project && !projectValkey ? project.id : undefined })
	);
</script>

{#snippet createLink()}
	<a href={createHref} class={buttonClasses('primary', 'md', '')} data-testid="create-valkey">
		<Plus size={16} weight="bold" aria-hidden="true" />
		{project && !projectValkey ? VALKEY_COPY.createForProject : VALKEY_COPY.create}
	</a>
{/snippet}

{#snippet projectBanner()}
	{#if project && canCreate}
		<p
			class="rounded-control border border-primary/30 bg-primary-50 px-4 py-3 text-sm text-foreground"
			role="status"
			data-testid="valkey-project-context"
		>
			{#if projectValkey}
				Proyek <span class="font-medium wrap-anywhere">{projectName}</span> sudah memakai Valkey
				<span class="font-mono wrap-anywhere">{projectValkey.name}</span>. Satu proyek memakai satu
				Valkey.
			{:else}
				Untuk proyek <span class="font-medium wrap-anywhere">{projectName}</span>: buka Valkey di
				bawah untuk dipasang, atau buat Valkey baru yang langsung dipasang ke proyek itu.
			{/if}
		</p>
	{/if}
{/snippet}

<div class="flex flex-col gap-6">
	{#if !workspaces.isSettled || (active && (limitsQuery.isPending || (enabled && valkeysQuery.isPending)))}
		<div class="flex flex-col gap-3" role="status" aria-label="Memuat Valkey">
			<div class="skeleton h-28 w-full"></div>
			<div class="skeleton h-24 w-full"></div>
		</div>
	{:else if !active}
		<ErrorBlock
			title="Workspace belum bisa dimuat"
			description="Valkey milik workspace, jadi daftar ini menunggu daftar workspace kamu. Muat ulang halaman."
			onRetry={() => location.reload()}
		/>
	{:else if limitsQuery.isError}
		<ErrorBlock
			title="Valkey belum bisa dimuat"
			description="Batas workspace belum bisa dibaca, jadi Console belum tahu apakah Valkey tersedia. Muat ulang halaman."
			onRetry={() => limitsQuery.refetch()}
		/>
	{:else if !enabled}
		<EmptyState
			icon={Memory}
			tone="muted"
			title={VALKEY_COPY.disabledTitle}
			description={VALKEY_COPY.disabledBody}
		/>
	{:else if valkeysQuery.isError}
		<ErrorBlock
			title="Valkey belum bisa dimuat"
			description={valkeyErrorMessage(
				valkeysQuery.error,
				'load',
				'Daftar Valkey belum bisa dimuat. Data di Valkey kamu tidak terpengaruh.'
			)}
			onRetry={() => valkeysQuery.refetch()}
		/>
	{:else if valkeys.length === 0 && closed}
		<div data-testid="valkeys-closed">
			<EmptyState
				icon={Memory}
				tone="muted"
				title={VALKEY_COPY.noQuota}
				description={VALKEY_COPY.noQuotaBody}
			/>
		</div>
	{:else if valkeys.length === 0 && unavailable}
		<EmptyState
			icon={Memory}
			tone="muted"
			title={VALKEY_COPY.unavailableTitle}
			description={VALKEY_COPY.unavailableBody}
		/>
	{:else if valkeys.length === 0}
		{@render projectBanner()}
		<EmptyState
			icon={Memory}
			tone={access.canManage ? 'neutral' : 'muted'}
			title={`Belum ada Valkey di ${workspaceName}`}
			description={`${VALKEY_COPY.whatIs} Buat satu, lalu pasang ke proyek: Sakala menambahkan REDIS_URL dan variabel REDIS_* lainnya saat deploy berikutnya.`}
			action={canStart ? createLink : undefined}
		/>
		{#if quota}
			<ValkeyQuotaSummary {quota} {workspaceName} showBlockedReason={!siteAdmin} />
		{/if}
		{#if !access.canManage}
			<p class="text-sm text-muted" data-testid="valkey-viewer-note">{VALKEY_COPY.viewerNote}</p>
		{/if}
	{:else}
		{#snippet toolbar()}
			<div class="flex min-w-0 flex-1 basis-64 flex-col gap-2">
				<p class="text-sm text-muted" data-testid="valkeys-intro">
					{VALKEY_COPY.listIntro}
					<span class="wrap-anywhere text-foreground">{workspaceName}</span>; tetap ada walaupun
					proyeknya dihapus.
				</p>
				{#if !access.canManage}
					<p class="text-sm text-muted" data-testid="valkey-viewer-note">
						{VALKEY_COPY.viewerNote}
					</p>
				{:else if quota}
					<ValkeyQuotaSummary {quota} {workspaceName} showBlockedReason={!siteAdmin} compact />
				{/if}
			</div>
			{#if canStart}
				<div class="shrink-0">{@render createLink()}</div>
			{/if}
		{/snippet}
		<!-- The list template, as for databases and buckets: quota and the primary action above. -->
		<ListPageLayout {toolbar}>
			{@render projectBanner()}
			{#if unavailable}
				<p
					class="flex items-start gap-3 rounded-control border border-border bg-background-soft px-4 py-3 text-sm text-foreground"
					role="status"
					data-testid="valkeys-unavailable"
				>
					<Memory size={20} class="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
					<span>
						<span class="font-medium">{VALKEY_COPY.unavailableTitle}.</span>
						{VALKEY_COPY.unavailableBody}
					</span>
				</p>
			{/if}
			<ValkeyList {valkeys} workspaceId={active.id} projectId={project?.id} />
		</ListPageLayout>
	{/if}
</div>

<script lang="ts">
	import { page } from '$app/state';
	import { DatabaseIcon } from '$lib/components/icons';
	import Plus from 'phosphor-svelte/lib/Plus';
	import EmptyState from '$lib/components/feedback/EmptyState.svelte';
	import ErrorBlock from '$lib/components/feedback/ErrorBlock.svelte';
	import ListPageLayout from '$lib/components/layout/templates/ListPageLayout.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { useCurrentUser } from '$lib/features/auth/queries';
	import { isAdmin } from '$lib/features/admin/access';
	import { createProjectQuery } from '$lib/features/projects/queries';
	import { useActiveWorkspace } from '$lib/features/workspaces/access.svelte';
	import { limitsWorkspaceId } from '$lib/features/workspaces/presentation';
	import { createWorkspaceLimitsQuery } from '$lib/features/workspaces/queries';
	import { databaseAccess } from '../access';
	import {
		DATABASE_COPY,
		DATABASE_VARIABLES,
		databaseErrorMessage,
		databaseQuota,
		databasesUnavailable,
		workspacePhrase
	} from '../presentation';
	import { createDatabasesQuery } from '../queries';
	import { DATABASE_PROJECT_PARAM } from '../routes';
	import CreateDatabaseDialog from './CreateDatabaseDialog.svelte';
	import DatabaseList from './DatabaseList.svelte';
	import DatabaseQuotaSummary from './DatabaseQuotaSummary.svelte';

	const userQuery = useCurrentUser();
	const workspaces = useActiveWorkspace();
	const active = $derived(workspaces.active);
	const siteAdmin = $derived(isAdmin(userQuery.data));
	const access = $derived(databaseAccess(active?.role, siteAdmin));

	const databasesQuery = createDatabasesQuery(() => active?.id ?? null);
	const limitsQuery = createWorkspaceLimitsQuery(
		() => limitsWorkspaceId(active),
		() => ({ enabled: Boolean(active) })
	);
	const quota = $derived(databaseQuota(limitsQuery.data?.quotas));
	// No database server on this installation: nothing to create, existing ones still listed.
	const unavailable = $derived(databasesUnavailable(limitsQuery.data));
	const canCreate = $derived(access.canManage && !unavailable);
	// Admins are not held to the workspace's count; the API decides for them.
	const blockedReason = $derived(siteAdmin ? null : (quota?.blockedReason ?? null));

	// A project's "Buat database" link opens the dialog with the project's region.
	const projectId = $derived(page.url.searchParams.get(DATABASE_PROJECT_PARAM));
	const projectQuery = createProjectQuery(() => projectId ?? '');
	const project = $derived(
		projectQuery.data && projectQuery.data.workspace?.id === active?.id ? projectQuery.data : null
	);

	let createOpen = $state(false);

	const databases = $derived(databasesQuery.data ?? []);
	const workspaceName = $derived(workspacePhrase(active));
</script>

{#snippet createButton()}
	<Button onclick={() => (createOpen = true)} data-testid="create-database">
		<Plus size={16} weight="bold" aria-hidden="true" />
		{DATABASE_COPY.create}
	</Button>
{/snippet}

{#snippet unavailableNotice()}
	<div
		class="flex items-start gap-3 rounded-control border border-border bg-background-soft px-4 py-3"
		role="status"
		data-testid="databases-unavailable"
	>
		<DatabaseIcon size={20} class="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
		<div class="flex min-w-0 flex-col gap-1">
			<p class="text-sm font-medium text-foreground">{DATABASE_COPY.unavailableTitle}</p>
			<p class="text-sm text-muted">{DATABASE_COPY.unavailableBody}</p>
		</div>
	</div>
{/snippet}

{#snippet projectBanner()}
	{#if project && canCreate}
		<p
			class="rounded-control border border-primary/30 bg-primary-50 px-4 py-3 text-sm text-foreground"
			role="status"
			data-testid="database-project-context"
		>
			Untuk proyek <span class="font-medium wrap-anywhere">{project.name}</span>: pilih database di
			bawah untuk dipasang, atau buat yang baru di region proyek itu.
		</p>
	{/if}
{/snippet}

<div class="flex flex-col gap-6">
	{#if !workspaces.isSettled || (active && databasesQuery.isPending)}
		<div class="flex flex-col gap-3" role="status" aria-label="Memuat database">
			<div class="skeleton h-28 w-full"></div>
			<div class="skeleton h-24 w-full"></div>
		</div>
	{:else if !active}
		<ErrorBlock
			title="Workspace belum bisa dimuat"
			description="Database milik workspace, jadi daftar ini menunggu daftar workspace kamu. Muat ulang halaman."
			onRetry={() => location.reload()}
		/>
	{:else if databasesQuery.isError}
		<ErrorBlock
			title="Database belum bisa dimuat"
			description={databaseErrorMessage(
				databasesQuery.error,
				'load',
				'Daftar database belum bisa dimuat. Data di database kamu tidak terpengaruh.'
			)}
			onRetry={() => databasesQuery.refetch()}
		/>
	{:else if databases.length === 0 && unavailable}
		<EmptyState
			icon={DatabaseIcon}
			tone="muted"
			title={DATABASE_COPY.unavailableTitle}
			description={DATABASE_COPY.unavailableBody}
		/>
	{:else if databases.length === 0}
		{@render projectBanner()}
		<EmptyState
			icon={DatabaseIcon}
			tone={access.canManage ? 'neutral' : 'muted'}
			title={`Belum ada database di ${workspaceName}`}
			description={`Database PostgreSQL terkelola milik workspace ini, terpisah dari proyek. Buat satu, lalu pasang ke proyek: Sakala menambahkan ${DATABASE_VARIABLES[0]} dan variabel DB_* ke aplikasimu saat deploy berikutnya.`}
			action={access.canManage ? createButton : undefined}
		/>
		{#if quota}
			<DatabaseQuotaSummary {quota} {workspaceName} showBlockedReason={!siteAdmin} />
		{/if}
		{#if !access.canManage}
			<p class="text-sm text-muted" data-testid="database-viewer-note">
				{DATABASE_COPY.viewerNote}
			</p>
		{/if}
	{:else}
		{#snippet toolbar()}
			<div class="flex min-w-0 flex-1 basis-64 flex-col gap-2">
				<p class="text-sm text-muted" data-testid="databases-intro">
					PostgreSQL milik <span class="wrap-anywhere text-foreground">{workspaceName}</span>; tetap
					ada walaupun proyeknya dihapus.
				</p>
				{#if !access.canManage}
					<p class="text-sm text-muted" data-testid="database-viewer-note">
						{DATABASE_COPY.viewerNote}
					</p>
				{:else if quota}
					<DatabaseQuotaSummary {quota} {workspaceName} showBlockedReason={!siteAdmin} compact />
				{/if}
			</div>
			{#if canCreate}
				<div class="shrink-0">{@render createButton()}</div>
			{/if}
		{/snippet}
		<!-- The list template: the quota and the primary action above, the list across the width. -->
		<ListPageLayout {toolbar}>
			{@render projectBanner()}
			{#if unavailable}
				{@render unavailableNotice()}
			{/if}
			<DatabaseList
				{databases}
				workspaceId={active.id}
				projectId={project?.id}
				storageQuotaMb={limitsQuery.data?.quotas.max_database_storage_mb}
			/>
		</ListPageLayout>
	{/if}
</div>

{#if active && canCreate}
	<CreateDatabaseDialog
		bind:open={createOpen}
		workspaceId={active.id}
		{workspaceName}
		{blockedReason}
		defaultRegion={project?.region ?? null}
		workspaceDefaultRegion={active.default_region ?? null}
		projectId={project?.id ?? null}
		projectName={project?.name ?? null}
	/>
{/if}

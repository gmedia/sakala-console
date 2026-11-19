<script lang="ts">
	import { page } from '$app/state';
	import Database from 'phosphor-svelte/lib/Database';
	import Plus from 'phosphor-svelte/lib/Plus';
	import EmptyState from '$lib/components/feedback/EmptyState.svelte';
	import ErrorBlock from '$lib/components/feedback/ErrorBlock.svelte';
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

{#snippet projectBanner()}
	{#if project && access.canManage}
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
	{:else if databases.length === 0}
		{@render projectBanner()}
		<EmptyState
			icon={Database}
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
		{@render projectBanner()}
		<div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
			<p class="max-w-2xl text-sm text-muted">
				PostgreSQL terkelola milik <span class="wrap-anywhere text-foreground">{workspaceName}</span
				>. Satu database bisa dipasang ke beberapa proyek, dan tetap ada walaupun proyeknya dihapus.
			</p>
			{#if access.canManage}
				<div class="shrink-0">{@render createButton()}</div>
			{/if}
		</div>
		{#if quota}
			<DatabaseQuotaSummary {quota} {workspaceName} showBlockedReason={!siteAdmin} />
		{/if}
		{#if !access.canManage}
			<p class="text-sm text-muted" data-testid="database-viewer-note">
				{DATABASE_COPY.viewerNote}
			</p>
		{/if}
		<DatabaseList
			{databases}
			workspaceId={active.id}
			projectId={project?.id}
			storageQuotaMb={limitsQuery.data?.quotas.max_database_storage_mb}
		/>
	{/if}
</div>

{#if active && access.canManage}
	<CreateDatabaseDialog
		bind:open={createOpen}
		workspaceId={active.id}
		{workspaceName}
		{blockedReason}
		defaultRegion={project?.region ?? null}
		projectId={project?.id ?? null}
		projectName={project?.name ?? null}
	/>
{/if}

<script lang="ts">
	import { resolve } from '$app/paths';
	import { DatabaseIcon } from '$lib/components/icons';
	import ErrorBlock from '$lib/components/feedback/ErrorBlock.svelte';
	import { ApiError } from '$lib/api/errors';
	import { useCurrentUser } from '$lib/features/auth/queries';
	import { isAdmin } from '$lib/features/admin/access';
	import { useActiveWorkspace } from '$lib/features/workspaces/access.svelte';
	import { limitsWorkspaceId } from '$lib/features/workspaces/presentation';
	import { createWorkspaceLimitsQuery } from '$lib/features/workspaces/queries';
	import { databaseAccess } from '../access';
	import {
		DATABASE_COPY,
		addRedeployNotices,
		databaseErrorMessage,
		databaseQuota,
		type RedeployNotice
	} from '../presentation';
	import { createDatabaseQuery } from '../queries';
	import { useDatabaseRoute } from '../route-state.svelte';
	import DatabaseConnectionCard from './DatabaseConnectionCard.svelte';
	import DatabaseExtensionsCard from './DatabaseExtensionsCard.svelte';
	import DatabaseOverviewCard from './DatabaseOverviewCard.svelte';
	import DatabaseProjectsCard from './DatabaseProjectsCard.svelte';
	import DatabaseSettingsCard from './DatabaseSettingsCard.svelte';
	import DatabasePanel from './DatabasePanel.svelte';
	import FormPageLayout from '$lib/components/layout/templates/FormPageLayout.svelte';
	import { DATABASE_PANEL_COPY } from '../panel';

	type Props = { workspaceId: string | null; databaseId: string };

	let { workspaceId, databaseId }: Props = $props();

	const route = useDatabaseRoute();
	const userQuery = useCurrentUser();
	const workspaces = useActiveWorkspace();
	const workspace = $derived(workspaces.workspaces.find((item) => item.id === workspaceId) ?? null);
	const access = $derived(databaseAccess(workspace?.role, isAdmin(userQuery.data)));

	const databaseQuery = createDatabaseQuery(
		() => workspaceId,
		() => databaseId
	);
	const limitsQuery = createWorkspaceLimitsQuery(
		() => limitsWorkspaceId(workspace),
		() => ({ enabled: Boolean(workspace) })
	);
	const quota = $derived(databaseQuota(limitsQuery.data?.quotas));
	const database = $derived(databaseQuery.data);

	let notices = $state<RedeployNotice[]>([]);

	function addNotices(added: RedeployNotice[]) {
		notices = addRedeployNotices(notices, added);
	}

	const notFound = $derived(
		databaseQuery.error instanceof ApiError && databaseQuery.error.status === 404
	);
</script>

{#if !workspaceId || databaseQuery.isPending}
	<div class="flex flex-col gap-4" role="status" aria-label="Memuat database">
		<div class="skeleton h-40 w-full"></div>
		<div class="skeleton h-32 w-full"></div>
	</div>
{:else if databaseQuery.isError || !database}
	<ErrorBlock
		icon={DatabaseIcon}
		title={notFound ? 'Database tidak ditemukan' : 'Database belum bisa dimuat'}
		description={databaseErrorMessage(
			databaseQuery.error,
			'load',
			'Database belum bisa dimuat. Data di dalamnya tidak terpengaruh.'
		)}
		onRetry={notFound ? undefined : () => databaseQuery.refetch()}
		links={[{ label: 'Lihat semua database', href: resolve('/databases') }]}
	/>
{:else}
	{#snippet panel()}
		<DatabasePanel {database} canManage={access.canManage} />
	{/snippet}
	{#snippet danger()}
		<DatabaseSettingsCard {database} {workspaceId} parts="delete" />
	{/snippet}
	<!-- The form template: the database's cards left, the panel right, deleting last on every screen. -->
	<FormPageLayout
		panelLabel={DATABASE_PANEL_COPY.label}
		{panel}
		after={access.canManage ? danger : undefined}
	>
		{#if !access.canManage}
			<p class="text-sm text-muted" data-testid="database-viewer-note">
				{DATABASE_COPY.viewerNote}
			</p>
		{/if}
		<DatabaseOverviewCard
			{database}
			storageQuotaMb={limitsQuery.data?.quotas.max_database_storage_mb}
			workspaceStorage={quota?.storage ?? null}
		/>
		<DatabaseProjectsCard
			{database}
			{workspaceId}
			{access}
			{notices}
			preselectedProjectId={route.projectId}
			onChanged={addNotices}
		/>
		<DatabaseConnectionCard {database} {workspaceId} {access} />
		<DatabaseExtensionsCard {database} {workspaceId} {access} />
		{#if access.canManage}
			<DatabaseSettingsCard {database} {workspaceId} parts="edit" />
		{/if}
	</FormPageLayout>
{/if}

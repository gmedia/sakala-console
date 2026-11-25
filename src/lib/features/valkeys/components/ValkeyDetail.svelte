<script lang="ts">
	import { resolve } from '$app/paths';
	import Memory from 'phosphor-svelte/lib/Memory';
	import EmptyState from '$lib/components/feedback/EmptyState.svelte';
	import ErrorBlock from '$lib/components/feedback/ErrorBlock.svelte';
	import { ApiError } from '$lib/api/errors';
	import { useCurrentUser } from '$lib/features/auth/queries';
	import { isAdmin } from '$lib/features/admin/access';
	import { addRedeployNotices } from '$lib/features/databases/presentation';
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
		type ValkeyRedeployNotice
	} from '../presentation';
	import { createValkeyQuery } from '../queries';
	import { useValkeyRoute } from '../route-state.svelte';
	import ValkeyConnectionCard from './ValkeyConnectionCard.svelte';
	import ValkeyOverviewCard from './ValkeyOverviewCard.svelte';
	import ValkeyProjectsCard from './ValkeyProjectsCard.svelte';
	import ValkeySettingsCard from './ValkeySettingsCard.svelte';
	import ValkeyUsageHintCard from './ValkeyUsageHintCard.svelte';

	type Props = { workspaceId: string | null; valkeyId: string };

	let { workspaceId, valkeyId }: Props = $props();

	const route = useValkeyRoute();
	const userQuery = useCurrentUser();
	const workspaces = useActiveWorkspace();
	const workspace = $derived(workspaces.workspaces.find((item) => item.id === workspaceId) ?? null);
	const siteAdmin = $derived(isAdmin(userQuery.data));
	const access = $derived(valkeyAccess(workspace?.role, siteAdmin));

	const limitsQuery = createWorkspaceLimitsQuery(
		() => limitsWorkspaceId(workspace),
		() => ({ enabled: Boolean(workspace) })
	);
	const limits = $derived(limitsQuery.data);
	// A link typed by hand while the server's flag is off: say so, without asking for the store.
	const disabled = $derived(Boolean(limits) && !valkeysEnabled(limits));
	const valkeyQuery = createValkeyQuery(
		() => workspaceId,
		() => valkeyId,
		() => ({ enabled: !disabled })
	);
	const sizes = $derived(valkeySizes(limits));
	const quota = $derived(valkeyQuota(limits?.quotas, Math.min(...sizes)));
	const valkey = $derived(valkeyQuery.data);
	const availableMb = $derived(siteAdmin || !quota ? null : quota.remainingMb);

	// The same keyed list as databases; the notices only differ in their words.
	let notices = $state<ValkeyRedeployNotice[]>([]);

	function addNotices(added: ValkeyRedeployNotice[]) {
		notices = addRedeployNotices(notices, added);
	}

	const notFound = $derived(
		valkeyQuery.error instanceof ApiError && valkeyQuery.error.status === 404
	);
</script>

{#if disabled}
	<EmptyState
		icon={Memory}
		tone="muted"
		title={VALKEY_COPY.disabledTitle}
		description={VALKEY_COPY.disabledBody}
	/>
{:else if !workspaceId || valkeyQuery.isPending}
	<div class="flex flex-col gap-4" role="status" aria-label="Memuat Valkey">
		<div class="skeleton h-40 w-full"></div>
		<div class="skeleton h-32 w-full"></div>
	</div>
{:else if valkeyQuery.isError || !valkey}
	<ErrorBlock
		icon={Memory}
		title={notFound ? 'Valkey tidak ditemukan' : 'Valkey belum bisa dimuat'}
		description={valkeyErrorMessage(
			valkeyQuery.error,
			'load',
			'Valkey belum bisa dimuat. Data di dalamnya tidak terpengaruh.'
		)}
		onRetry={notFound ? undefined : () => valkeyQuery.refetch()}
		links={[{ label: 'Lihat semua Valkey', href: resolve('/valkeys') }]}
	/>
{:else}
	<div class="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-6">
		<div class="flex min-w-0 flex-col gap-4 lg:gap-6">
			{#if !access.canManage}
				<p class="text-sm text-muted" data-testid="valkey-viewer-note">{VALKEY_COPY.viewerNote}</p>
			{/if}
			<ValkeyOverviewCard {valkey} />
			<ValkeyProjectsCard
				{valkey}
				{workspaceId}
				{access}
				{notices}
				preselectedProjectId={route.projectId}
				onChanged={addNotices}
			/>
			<ValkeyConnectionCard {valkey} {workspaceId} {access} />
		</div>
		<aside class="flex min-w-0 flex-col gap-4 lg:gap-6" aria-label="Petunjuk dan pengaturan Valkey">
			<ValkeyUsageHintCard mode={valkey.mode} />
			{#if access.canManage}
				<ValkeySettingsCard {valkey} {workspaceId} {sizes} {availableMb} />
			{/if}
		</aside>
	</div>
{/if}

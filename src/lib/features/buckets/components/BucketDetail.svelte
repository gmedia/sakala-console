<script lang="ts">
	import { resolve } from '$app/paths';
	import Archive from 'phosphor-svelte/lib/Archive';
	import ErrorBlock from '$lib/components/feedback/ErrorBlock.svelte';
	import { ApiError } from '$lib/api/errors';
	import { useCurrentUser } from '$lib/features/auth/queries';
	import { isAdmin } from '$lib/features/admin/access';
	import { addRedeployNotices } from '$lib/features/databases/presentation';
	import { useActiveWorkspace } from '$lib/features/workspaces/access.svelte';
	import { limitsWorkspaceId } from '$lib/features/workspaces/presentation';
	import { createWorkspaceLimitsQuery } from '$lib/features/workspaces/queries';
	import { bucketAccess } from '../access';
	import {
		BUCKET_COPY,
		bucketErrorMessage,
		bucketQuota,
		type BucketRedeployNotice
	} from '../presentation';
	import { createBucketQuery } from '../queries';
	import { useBucketRoute } from '../route-state.svelte';
	import BucketConnectionCard from './BucketConnectionCard.svelte';
	import BucketOverviewCard from './BucketOverviewCard.svelte';
	import BucketProjectsCard from './BucketProjectsCard.svelte';
	import BucketSettingsCard from './BucketSettingsCard.svelte';
	import BucketUsageHintCard from './BucketUsageHintCard.svelte';

	type Props = { workspaceId: string | null; bucketId: string };

	let { workspaceId, bucketId }: Props = $props();

	const route = useBucketRoute();
	const userQuery = useCurrentUser();
	const workspaces = useActiveWorkspace();
	const workspace = $derived(workspaces.workspaces.find((item) => item.id === workspaceId) ?? null);
	const siteAdmin = $derived(isAdmin(userQuery.data));
	const access = $derived(bucketAccess(workspace?.role, siteAdmin));

	const bucketQuery = createBucketQuery(
		() => workspaceId,
		() => bucketId
	);
	const limitsQuery = createWorkspaceLimitsQuery(
		() => limitsWorkspaceId(workspace),
		() => ({ enabled: Boolean(workspace) })
	);
	const quota = $derived(bucketQuota(limitsQuery.data?.quotas));
	const bucket = $derived(bucketQuery.data);
	// The bucket's own quota is part of what it may grow into.
	const maxQuotaMb = $derived(
		siteAdmin || !quota || !bucket ? null : quota.remainingMb + bucket.quota_mb
	);

	// The same keyed list as databases; the notices only differ in their words.
	let notices = $state<BucketRedeployNotice[]>([]);

	function addNotices(added: BucketRedeployNotice[]) {
		notices = addRedeployNotices(notices, added);
	}

	const notFound = $derived(
		bucketQuery.error instanceof ApiError && bucketQuery.error.status === 404
	);
</script>

{#if !workspaceId || bucketQuery.isPending}
	<div class="flex flex-col gap-4" role="status" aria-label="Memuat bucket">
		<div class="skeleton h-40 w-full"></div>
		<div class="skeleton h-32 w-full"></div>
	</div>
{:else if bucketQuery.isError || !bucket}
	<ErrorBlock
		icon={Archive}
		title={notFound ? 'Bucket tidak ditemukan' : 'Bucket belum bisa dimuat'}
		description={bucketErrorMessage(
			bucketQuery.error,
			'load',
			'Bucket belum bisa dimuat. Berkas di dalamnya tidak terpengaruh.'
		)}
		onRetry={notFound ? undefined : () => bucketQuery.refetch()}
		links={[{ label: 'Lihat semua bucket', href: resolve('/buckets') }]}
	/>
{:else}
	<div class="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-6">
		<div class="flex min-w-0 flex-col gap-4 lg:gap-6">
			{#if !access.canManage}
				<p class="text-sm text-muted" data-testid="bucket-viewer-note">{BUCKET_COPY.viewerNote}</p>
			{/if}
			<BucketOverviewCard {bucket} />
			<BucketProjectsCard
				{bucket}
				{workspaceId}
				{access}
				{notices}
				preselectedProjectId={route.projectId}
				onChanged={addNotices}
			/>
			<BucketConnectionCard {bucket} {workspaceId} {access} />
		</div>
		<aside class="flex min-w-0 flex-col gap-4 lg:gap-6" aria-label="Petunjuk dan pengaturan bucket">
			<BucketUsageHintCard />
			{#if access.canManage}
				<BucketSettingsCard {bucket} {workspaceId} {maxQuotaMb} />
			{/if}
		</aside>
	</div>
{/if}

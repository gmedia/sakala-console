<script lang="ts">
	// The guide is a page on the landing site, outside this app's routes.
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { page } from '$app/state';
	import { BucketIcon } from '$lib/components/icons';
	import ArrowSquareOut from 'phosphor-svelte/lib/ArrowSquareOut';
	import Plus from 'phosphor-svelte/lib/Plus';
	import EmptyState from '$lib/components/feedback/EmptyState.svelte';
	import ErrorBlock from '$lib/components/feedback/ErrorBlock.svelte';
	import ListPageLayout from '$lib/components/layout/templates/ListPageLayout.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import {
		BUCKET_GUIDE_ANCHORS,
		bucketGuideUrl,
		type BucketGuideAnchor
	} from '$lib/config/project';
	import { useCurrentUser } from '$lib/features/auth/queries';
	import { isAdmin } from '$lib/features/admin/access';
	import { workspacePhrase } from '$lib/features/databases/presentation';
	import { createProjectQuery } from '$lib/features/projects/queries';
	import { useActiveWorkspace } from '$lib/features/workspaces/access.svelte';
	import { limitsWorkspaceId } from '$lib/features/workspaces/presentation';
	import { createWorkspaceLimitsQuery } from '$lib/features/workspaces/queries';
	import { bucketAccess } from '../access';
	import {
		BUCKET_COPY,
		bucketErrorMessage,
		bucketQuota,
		bucketsUnavailable,
		defaultBucketQuotaMb
	} from '../presentation';
	import { createBucketsQuery } from '../queries';
	import { BUCKET_PROJECT_PARAM } from '../routes';
	import BucketList from './BucketList.svelte';
	import BucketQuotaSummary from './BucketQuotaSummary.svelte';
	import CreateBucketDialog from './CreateBucketDialog.svelte';

	const userQuery = useCurrentUser();
	const workspaces = useActiveWorkspace();
	const active = $derived(workspaces.active);
	const siteAdmin = $derived(isAdmin(userQuery.data));
	const access = $derived(bucketAccess(active?.role, siteAdmin));

	const limitsQuery = createWorkspaceLimitsQuery(
		() => limitsWorkspaceId(active),
		() => ({ enabled: Boolean(active) })
	);
	const limits = $derived(limitsQuery.data);
	// An API without buckets answers 404 here; ask only once the limits say the feature exists.
	const featurePresent = $derived(Boolean(limits?.buckets));
	const bucketsQuery = createBucketsQuery(
		() => active?.id ?? null,
		() => ({ enabled: featurePresent })
	);

	const quota = $derived(bucketQuota(limits?.quotas));
	const unavailable = $derived(bucketsUnavailable(limits));
	// The workspace was never opened for buckets: a quiet note, not an invitation to create.
	const closed = $derived(!siteAdmin && quota?.count.max === 0);
	const canCreate = $derived(access.canManage && !unavailable && !closed);
	// Admins are not held to the workspace's count; the API decides for them.
	const blockedReason = $derived(siteAdmin ? null : (quota?.blockedReason ?? null));
	const maxQuotaMb = $derived(siteAdmin ? null : (quota?.remainingMb ?? null));

	// "Buat bucket untuk proyek ini" links here with the project.
	const projectId = $derived(page.url.searchParams.get(BUCKET_PROJECT_PARAM));
	const projectQuery = createProjectQuery(() => projectId ?? '');
	const project = $derived(
		projectQuery.data && projectQuery.data.workspace?.id === active?.id ? projectQuery.data : null
	);
	const projectHasBucket = $derived((project?.buckets?.length ?? 0) > 0);
	const projectName = $derived(project?.name ?? project?.project_name ?? '');

	let createOpen = $state(false);
	let createForProject = $state(false);

	const buckets = $derived(bucketsQuery.data ?? []);
	const workspaceName = $derived(workspacePhrase(active));

	function openCreate(forProject: boolean) {
		createForProject = forProject;
		createOpen = true;
	}

	// From a project with nothing to choose from, the user came to create: open the dialog once.
	let autoOpened = false;
	$effect(() => {
		if (
			autoOpened ||
			!project ||
			projectHasBucket ||
			!canCreate ||
			blockedReason ||
			!bucketsQuery.isSuccess ||
			buckets.length > 0
		) {
			return;
		}
		autoOpened = true;
		openCreate(true);
	});
</script>

{#snippet createButton()}
	<Button
		onclick={() => openCreate(Boolean(project) && !projectHasBucket)}
		data-testid="create-bucket"
	>
		<Plus size={16} weight="bold" aria-hidden="true" />
		{BUCKET_COPY.create}
	</Button>
{/snippet}

{#snippet guideLink(label: string, anchor: BucketGuideAnchor | null)}
	<a
		href={bucketGuideUrl(anchor)}
		target="_blank"
		rel="noreferrer noopener"
		class="inline-flex min-h-6 items-center gap-1 self-start text-sm font-medium text-primary-dark underline underline-offset-2"
	>
		{label}
		<ArrowSquareOut size={14} aria-hidden="true" />
		<span class="sr-only">(tab baru)</span>
	</a>
{/snippet}

{#snippet unavailableNotice()}
	<div
		class="flex items-start gap-3 rounded-control border border-border bg-background-soft px-4 py-3"
		role="status"
		data-testid="buckets-unavailable"
	>
		<BucketIcon size={20} class="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
		<div class="flex min-w-0 flex-col gap-1">
			<p class="text-sm font-medium text-foreground">{BUCKET_COPY.unavailableTitle}</p>
			<p class="text-sm text-muted">{BUCKET_COPY.unavailableBody}</p>
		</div>
	</div>
{/snippet}

{#snippet projectBanner()}
	{#if project && canCreate}
		<p
			class="rounded-control border border-primary/30 bg-primary-50 px-4 py-3 text-sm text-foreground"
			role="status"
			data-testid="bucket-project-context"
		>
			{#if projectHasBucket}
				Proyek <span class="font-medium wrap-anywhere">{projectName}</span> sudah memakai bucket
				<span class="font-mono wrap-anywhere">{project.buckets?.[0]?.name}</span>. Satu proyek
				memakai satu bucket.
			{:else}
				Untuk proyek <span class="font-medium wrap-anywhere">{projectName}</span>: buka bucket di
				bawah untuk dipasang, atau buat bucket baru yang langsung dipasang ke proyek itu.
			{/if}
		</p>
	{/if}
{/snippet}

<div class="flex flex-col gap-6">
	{#if !workspaces.isSettled || (active && (limitsQuery.isPending || (featurePresent && bucketsQuery.isPending)))}
		<div class="flex flex-col gap-3" role="status" aria-label="Memuat bucket">
			<div class="skeleton h-28 w-full"></div>
			<div class="skeleton h-24 w-full"></div>
		</div>
	{:else if !active}
		<ErrorBlock
			title="Workspace belum bisa dimuat"
			description="Bucket milik workspace, jadi daftar ini menunggu daftar workspace kamu. Muat ulang halaman."
			onRetry={() => location.reload()}
		/>
	{:else if limitsQuery.isError}
		<ErrorBlock
			title="Bucket belum bisa dimuat"
			description="Batas workspace belum bisa dibaca, jadi Console belum tahu apakah bucket tersedia. Muat ulang halaman."
			onRetry={() => limitsQuery.refetch()}
		/>
	{:else if !featurePresent}
		<EmptyState
			icon={BucketIcon}
			tone="muted"
			title={BUCKET_COPY.unavailableTitle}
			description="Server Sakala ini belum mendukung bucket terkelola."
		/>
	{:else if bucketsQuery.isError}
		<ErrorBlock
			title="Bucket belum bisa dimuat"
			description={bucketErrorMessage(
				bucketsQuery.error,
				'load',
				'Daftar bucket belum bisa dimuat. Berkas di bucket kamu tidak terpengaruh.'
			)}
			onRetry={() => bucketsQuery.refetch()}
		/>
	{:else if buckets.length === 0 && closed}
		<div class="flex flex-col gap-3" data-testid="buckets-closed">
			<EmptyState
				icon={BucketIcon}
				tone="muted"
				title={BUCKET_COPY.noQuota}
				description={BUCKET_COPY.noQuotaBody}
			/>
			{@render guideLink('Cara meminta kuota bucket', BUCKET_GUIDE_ANCHORS.requestQuota)}
		</div>
	{:else if buckets.length === 0 && unavailable}
		<EmptyState
			icon={BucketIcon}
			tone="muted"
			title={BUCKET_COPY.unavailableTitle}
			description={BUCKET_COPY.unavailableBody}
		/>
	{:else if buckets.length === 0}
		{@render projectBanner()}
		<EmptyState
			icon={BucketIcon}
			tone={access.canManage ? 'neutral' : 'muted'}
			title={`Belum ada bucket di ${workspaceName}`}
			description="Bucket menyimpan berkas yang harus bertahan, misalnya foto yang di-upload pengguna. Buat satu, lalu pasang ke proyek: Sakala menambahkan variabel AWS_* ke aplikasimu saat deploy berikutnya."
			action={canCreate ? createButton : undefined}
		/>
		{#if quota}
			<BucketQuotaSummary {quota} {workspaceName} showBlockedReason={!siteAdmin} />
		{/if}
		{#if !access.canManage}
			<p class="text-sm text-muted" data-testid="bucket-viewer-note">{BUCKET_COPY.viewerNote}</p>
		{/if}
	{:else}
		{#snippet toolbar()}
			<div class="flex min-w-0 flex-1 basis-64 flex-col gap-2">
				<p class="text-sm text-muted" data-testid="buckets-intro">
					Penyimpanan berkas S3 milik <span class="wrap-anywhere text-foreground"
						>{workspaceName}</span
					>; tetap ada walaupun proyeknya dihapus.
				</p>
				{#if !access.canManage}
					<p class="text-sm text-muted" data-testid="bucket-viewer-note">
						{BUCKET_COPY.viewerNote}
					</p>
				{:else if quota}
					<BucketQuotaSummary {quota} {workspaceName} showBlockedReason={!siteAdmin} compact />
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
			<BucketList {buckets} workspaceId={active.id} projectId={project?.id} />
		</ListPageLayout>
	{/if}
</div>

{#if active && canCreate}
	<CreateBucketDialog
		bind:open={createOpen}
		workspaceId={active.id}
		{workspaceName}
		{blockedReason}
		defaultQuotaMb={defaultBucketQuotaMb(limits, siteAdmin)}
		{maxQuotaMb}
		workspaceDefaultRegion={active.default_region ?? null}
		project={createForProject && project
			? { id: project.id, name: projectName, region: project.region ?? null }
			: null}
	/>
{/if}

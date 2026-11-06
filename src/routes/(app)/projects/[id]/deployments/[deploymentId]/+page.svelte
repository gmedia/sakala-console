<script lang="ts">
	import { pageTitle } from '$lib/utils/page-title';
	import ArrowCounterClockwise from 'phosphor-svelte/lib/ArrowCounterClockwise';
	import WarningCircle from 'phosphor-svelte/lib/WarningCircle';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import {
		formatResourceLimit,
		getDeploymentTriggerLabel,
		TERMINAL_STATUSES
	} from '$lib/features/deployments/deployment-presentation';
	import { getErrorMessage } from '$lib/api/errors';
	import Breadcrumb from '$lib/components/ui/Breadcrumb.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import CancelDeploymentDialog from '$lib/features/deployments/components/CancelDeploymentDialog.svelte';
	import { createCancelDeploymentMutation } from '$lib/features/deployments/mutations';
	import { feedbackPath } from '$lib/features/feedback/context';
	import { deriveProjectHeaderState } from '$lib/features/projects/presentation';
	import { createRecentDeploymentsQuery } from '$lib/features/projects/queries';
	import DeploymentStatusBanner from '$lib/features/deployments/components/DeploymentStatusBanner.svelte';
	import DeploymentInfoRow from '$lib/features/deployments/components/DeploymentInfoRow.svelte';
	import DeploymentTimeline from '$lib/features/deployments/components/DeploymentTimeline.svelte';
	import DeploymentLogPanel from '$lib/features/deployments/components/DeploymentLogPanel.svelte';
	import { revealFailureDetails } from '$lib/features/deployments/focus-failure';
	import { useDeploymentDetail } from '$lib/features/deployments/use-deployment-detail.svelte';
	import { useFailedDeploymentRedeploy } from '$lib/features/deployments/use-failed-deployment-redeploy.svelte';
	import EmptyState from '$lib/components/feedback/EmptyState.svelte';
	import DeploymentLiveAnnouncement from '$lib/components/feedback/DeploymentLiveAnnouncement.svelte';

	const detail = useDeploymentDetail(
		() => page.params.id ?? '',
		() => page.params.deploymentId ?? ''
	);

	const redeploy = useFailedDeploymentRedeploy(() =>
		detail.project && page.params.id ? { id: page.params.id, branch: detail.project.branch } : null
	);

	const recentDeployments = createRecentDeploymentsQuery(() => page.params.id ?? '');
	const projectState = $derived(
		detail.project
			? deriveProjectHeaderState(detail.project, recentDeployments.data?.data ?? [])
			: null
	);
	const redeployBlockedReason = $derived.by(() => {
		if (projectState?.kind === 'suspended') return projectState.notice?.message;
		if (projectState?.redeployBusy) {
			return 'Deployment lain sedang berjalan, jadi Redeploy belum bisa dijalankan.';
		}
		return undefined;
	});

	const breadcrumb = $derived([
		{ label: 'Riwayat deployment', href: `/projects/${page.params.id}/deployments` as const },
		{ label: `Deployment #${detail.deployment?.sequence ?? ''}`, current: true }
	]);

	const cancel = createCancelDeploymentMutation(
		() => page.params.id ?? '',
		() => page.params.deploymentId ?? ''
	);
	let cancelOpen = $state(false);
	let cancelError = $state('');
	const isFinished = $derived(TERMINAL_STATUSES.has(detail.deployment?.status ?? ''));

	function handleConfirmCancel() {
		if (cancel.isPending) return;
		cancelError = '';
		cancel.mutate(undefined, {
			onSuccess: () => {
				cancelOpen = false;
			},
			onError: (error) => {
				cancelError = getErrorMessage(
					error,
					'Deployment belum bisa dibatalkan. Silakan coba lagi.'
				);
			}
		});
	}

	function handleCloseCancel() {
		cancelOpen = false;
		cancelError = '';
	}
</script>

<svelte:head>
	<title>
		{pageTitle(
			detail.deployment ? `Deployment #${detail.deployment.sequence}` : 'Detail deployment',
			detail.project?.name
		)}
	</title>
</svelte:head>

{#if detail.isLoading && !detail.deployment}
	<div class="flex flex-col gap-4" role="status">
		<span class="sr-only">Memuat detail deployment...</span>
		<div class="skeleton h-5 w-48"></div>
		<div class="skeleton h-24 w-full"></div>
		<div class="skeleton h-16 w-full"></div>
		<div class="skeleton h-64 w-full"></div>
	</div>
{:else if detail.deploymentError && !detail.deployment}
	<EmptyState
		icon={WarningCircle}
		tone="failed"
		title={detail.deploymentError.title}
		description={detail.deploymentError.description}
		class="col-span-full border-none bg-transparent"
	>
		{#snippet action()}
			{#if detail.deploymentError?.showRetry}
				<Button onclick={() => detail.deploymentQuery.refetch()}>
					<ArrowCounterClockwise size={18} aria-hidden="true" />
					Coba lagi
				</Button>
			{/if}
		{/snippet}
	</EmptyState>
{:else if detail.deployment}
	<div>
		<Breadcrumb items={breadcrumb} class="mb-3 font-semibold text-sm" />

		{#if detail.deploymentError}
			<div
				role="status"
				class="mb-3 rounded-control border border-warning/30 bg-warning/10 px-4 py-2 text-sm text-warning-dark"
			>
				{detail.isWaitingForRateLimit
					? 'Permintaan ke server sedang dibatasi, jadi data di sini bisa sedikit tertinggal. Sakala mengambil data terbaru otomatis sebentar lagi.'
					: 'Gagal memuat data terbaru. Menampilkan data terakhir yang tersedia.'}
			</div>
		{/if}

		<DeploymentLiveAnnouncement status={detail.bannerInput.status} />
		<DeploymentStatusBanner
			{...detail.bannerInput}
			publicUrl={detail.publicUrl}
			onViewError={() => revealFailureDetails()}
			onRedeploy={projectState?.showRedeploy === false ? undefined : redeploy.trigger}
			onCancel={() => (cancelOpen = true)}
			redeployPending={redeploy.isPending}
			redeployDisabled={!redeploy.isReady || Boolean(projectState?.redeployBusy)}
			redeployError={redeploy.errorMessage}
			{redeployBlockedReason}
		/>

		<CancelDeploymentDialog
			open={cancelOpen && !isFinished}
			sequence={detail.deployment.sequence}
			isLoading={cancel.isPending}
			error={cancelError}
			onConfirm={handleConfirmCancel}
			onClose={handleCloseCancel}
		/>

		<DeploymentInfoRow
			commitSha={detail.deployment.commit_sha ?? '-'}
			branch={detail.deployment.branch}
			trigger={getDeploymentTriggerLabel(detail.deployment.trigger)}
			status={detail.bannerInput.status}
			timestamp={detail.infoTimestamp}
			lastUpdate={detail.lastUpdateTimestamp}
			resourceLimit={formatResourceLimit(detail.deployment)}
		/>

		<h2 class="font-semibold py-2 text-base">Tahapan</h2>
		{#if detail.eventsError}
			<EmptyState
				icon={WarningCircle}
				tone="failed"
				title={detail.eventsError.title}
				description={detail.eventsError.description}
				class="col-span-full border-none bg-transparent"
			>
				{#snippet action()}
					{#if detail.eventsError?.showRetry}
						<Button onclick={() => detail.deploymentEventsQuery.refetch()}>
							<ArrowCounterClockwise size={18} aria-hidden="true" />
							Coba lagi
						</Button>
					{/if}
				{/snippet}
			</EmptyState>
		{:else if detail.steps.length === 0}
			<p class="text-sm text-muted">
				Tahapan deployment ini tidak tercatat, jadi timeline-nya tidak bisa ditampilkan. Log di
				bawah mungkin masih bisa membantu.
			</p>
		{:else}
			<DeploymentTimeline steps={detail.steps} showSubtitle emphasizeRunning />
		{/if}

		{#key detail.deployment.id}
			<DeploymentLogPanel projectId={page.params.id ?? ''} deployment={detail.deployment} />
		{/key}

		{#if isFinished}
			<p class="text-sm text-foreground/70">
				Ada yang perlu kami tahu dari deployment ini?
				<!-- eslint-disable svelte/no-navigation-without-resolve -- resolved, plus a query -->
				<a
					class="text-primary underline underline-offset-2"
					href={feedbackPath(resolve('/feedback'), {
						projectId: page.params.id,
						deploymentId: page.params.deploymentId
					})}
				>
					Kirim masukan
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			</p>
		{/if}
	</div>
{:else}
	<EmptyState
		icon={WarningCircle}
		tone="muted"
		title="Deployment tidak tersedia"
		description="Data deployment ini belum bisa ditampilkan. Coba muat ulang halaman."
		class="col-span-full border-none bg-transparent"
	/>
{/if}

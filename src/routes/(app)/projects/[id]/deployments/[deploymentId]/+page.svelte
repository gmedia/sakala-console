<script lang="ts">
	import { pageTitle } from '$lib/utils/page-title';
	import ArrowCounterClockwise from 'phosphor-svelte/lib/ArrowCounterClockwise';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';
	import WarningCircle from 'phosphor-svelte/lib/WarningCircle';
	import { resolve, resolveRoute } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import { page } from '$app/state';
	import {
		formatResourceLimit,
		getCommitUrl,
		getDeploymentTriggerLabel,
		isFirstSuccessfulDeployment,
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
		{ label: 'Riwayat', href: `/projects/${page.params.id}/deployments` as const },
		{ label: `Deployment #${detail.deployment?.sequence ?? ''}`, current: true }
	]);

	const firstLiveProjectName = $derived(
		detail.deployment &&
			detail.project &&
			isFirstSuccessfulDeployment(detail.deployment, recentDeployments.data?.data ?? [])
			? detail.project.name
			: null
	);
	const commitUrl = $derived(
		getCommitUrl(detail.project?.repository_url, detail.deployment?.commit_sha)
	);
	const projectHref = $derived(
		resolveRoute('/(app)/projects/[id]/deployments', {
			id: page.params.id ?? ''
		}) as ResolvedPathname
	);

	let logPanel = $state<DeploymentLogPanel>();
	// Below 1024 px the log comes first, and the rest folds away until asked for.
	let detailsOpen = $state(false);

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
	<div class="flex flex-col gap-3 lg:h-[calc(100dvh-7.5rem)]" role="status">
		<span class="sr-only">Memuat detail deployment...</span>
		<div class="skeleton h-5 w-48"></div>
		<div class="skeleton h-16 w-full"></div>
		<div
			class="grid min-h-96 flex-1 grid-cols-1 gap-3 lg:grid-cols-[16.25rem_minmax(0,1fr)] lg:gap-4"
		>
			<div class="skeleton h-12 lg:h-auto"></div>
			<div class="skeleton h-80 lg:h-auto"></div>
		</div>
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
	<!-- Fills the space under the shell's header, so the terminal ends where the viewport does. -->
	<div class="flex flex-col gap-3 lg:h-[calc(100dvh-7.5rem)]">
		<div class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
			<Breadcrumb items={breadcrumb} class="shrink-0 text-sm font-semibold" />
			{#if detail.deployment.commit_message}
				<p
					class="min-w-0 flex-1 truncate text-sm text-foreground max-sm:basis-full lg:text-right"
					title={detail.deployment.commit_message}
					data-testid="deployment-commit-message"
				>
					{detail.deployment.commit_message}
				</p>
			{/if}
		</div>

		{#if detail.deploymentError}
			<div
				role="status"
				class="rounded-control border border-warning/30 bg-warning/10 px-4 py-2 text-sm text-warning-dark"
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
			{firstLiveProjectName}
			{projectHref}
			onViewError={() => logPanel?.revealError()}
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

		<div
			class="grid min-h-0 grid-cols-1 gap-3 lg:min-h-96 lg:flex-[1_0_0] lg:grid-cols-[16.25rem_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:gap-4"
		>
			<aside class="surface-card min-w-0 lg:overflow-y-auto" aria-label="Tahapan dan info">
				<button
					type="button"
					class="flex min-h-control-lg w-full cursor-pointer items-center justify-between gap-2 rounded-card px-4 text-left text-sm font-semibold text-foreground lg:hidden"
					aria-expanded={detailsOpen}
					aria-controls="deployment-details"
					onclick={() => (detailsOpen = !detailsOpen)}
				>
					<span class="min-w-0 truncate">
						{detail.bannerInput.currentStepLabel
							? `Tahapan: ${detail.bannerInput.currentStepLabel}`
							: 'Tahapan dan info'}
					</span>
					<CaretDown
						size={16}
						aria-hidden="true"
						class={detailsOpen ? 'shrink-0 rotate-180' : 'shrink-0'}
					/>
				</button>

				<div
					id="deployment-details"
					class="flex-col gap-4 p-4 pt-1 lg:flex lg:pt-4 {detailsOpen ? 'flex' : 'hidden'}"
				>
					<div>
						<h2 class="mb-3 font-sans text-sm text-foreground">Tahapan</h2>
						{#if detail.eventsError}
							<div role="alert" class="space-y-2 text-sm">
								<p class="font-semibold text-foreground">{detail.eventsError.title}</p>
								<p class="text-muted">{detail.eventsError.description}</p>
								{#if detail.eventsError.showRetry}
									<Button
										variant="secondary"
										size="sm"
										onclick={() => detail.deploymentEventsQuery.refetch()}
									>
										<ArrowCounterClockwise size={14} aria-hidden="true" />
										Coba lagi
									</Button>
								{/if}
							</div>
						{:else if detail.steps.length === 0}
							<p class="text-sm text-muted">
								Tahapan deployment ini tidak tercatat. Log-nya mungkin masih bisa membantu.
							</p>
						{:else}
							<DeploymentTimeline steps={detail.steps} />
						{/if}
					</div>

					<div class="border-t border-border pt-4">
						<DeploymentInfoRow
							commitSha={detail.deployment.commit_sha ?? '-'}
							{commitUrl}
							branch={detail.deployment.branch}
							trigger={getDeploymentTriggerLabel(detail.deployment.trigger)}
							status={detail.bannerInput.status}
							timestamp={detail.infoTimestamp}
							lastUpdate={detail.lastUpdateTimestamp}
							resourceLimit={formatResourceLimit(detail.deployment)}
						/>
					</div>

					{#if isFinished}
						<p class="border-t border-border pt-4 text-sm text-foreground/70">
							Ada yang perlu kami tahu dari deployment ini?
							<!-- eslint-disable svelte/no-navigation-without-resolve -- resolved, plus a query -->
							<a
								class="text-primary-dark underline underline-offset-2"
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
			</aside>

			<div class="h-[70dvh] min-h-80 min-w-0 lg:h-auto lg:min-h-0">
				{#key detail.deployment.id}
					<DeploymentLogPanel
						bind:this={logPanel}
						projectId={page.params.id ?? ''}
						deployment={detail.deployment}
					/>
				{/key}
			</div>
		</div>
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

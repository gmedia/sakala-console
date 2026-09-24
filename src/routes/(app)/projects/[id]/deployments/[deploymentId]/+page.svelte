<script lang="ts">
	import { CircleAlert, RotateCcw } from '@lucide/svelte';
	import { page } from '$app/state';
	import { getDeploymentTriggerLabel } from '$lib/features/deployments/deployment-presentation';
	import { mockLogs } from '$lib/features/deployments/mock/events';
	import DeploymentStatusBanner from '$lib/features/deployments/components/DeploymentStatusBanner.svelte';
	import DeploymentInfoRow from '$lib/features/deployments/components/DeploymentInfoRow.svelte';
	import DeploymentTimeline from '$lib/features/deployments/components/DeploymentTimeline.svelte';
	import DeploymentLogConsole from '$lib/features/deployments/components/DeploymentLogConsole.svelte';
	import { useDeploymentDetail } from '$lib/features/deployments/use-deployment-detail.svelte';
	import EmptyState from '$lib/components/feedback/EmptyState.svelte';
	import DeploymentLiveAnnouncement from '$lib/components/feedback/DeploymentLiveAnnouncement.svelte';

	const detail = useDeploymentDetail(
		() => page.params.id ?? '',
		() => page.params.deploymentId ?? ''
	);

	function handleViewError() {
		document.getElementById('deployment-logs')?.scrollIntoView({ behavior: 'smooth' });
	}

	let retryButtonClass = $derived(
		'inline-flex cursor-pointer gap-2 rounded-lg border border-muted/20 bg-primary px-4 py-3 ' +
			'font-montserrat-semibold text-white ' +
			'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'
	);
</script>

{#if detail.isLoading && !detail.deployment}
	<EmptyState
		icon={CircleAlert}
		tone="muted"
		title="Memuat detail deployment..."
		description="Harap tunggu, ini mungkin memakan waktu beberapa detik."
		class="col-span-full border-none bg-transparent shadow-none"
	/>
{:else if detail.deploymentError && !detail.deployment}
	<EmptyState
		icon={CircleAlert}
		tone="failed"
		title={detail.deploymentError.title}
		description={detail.deploymentError.description}
		class="col-span-full border-none bg-transparent shadow-none"
	>
		{#snippet action()}
			{#if detail.deploymentError?.showRetry}
				<button
					type="button"
					class={retryButtonClass}
					onclick={() => detail.deploymentQuery.refetch()}
				>
					<RotateCcw class="h-6 w-6" />
					Coba lagi
				</button>
			{/if}
		{/snippet}
	</EmptyState>
{:else if detail.deployment}
	<div class="px-6">
		{#if detail.deploymentError}
			<div
				role="status"
				class="mb-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-2 text-sm text-warning-dark"
			>
				Gagal memuat data terbaru. Menampilkan data terakhir yang tersedia.
			</div>
		{/if}

		<DeploymentLiveAnnouncement status={detail.bannerInput.status} />
		<DeploymentStatusBanner
			{...detail.bannerInput}
			publicUrl={detail.publicUrl}
			onViewError={handleViewError}
		/>

		<DeploymentInfoRow
			commitSha={detail.deployment.commit_sha ?? '-'}
			branch={detail.deployment.branch}
			trigger={getDeploymentTriggerLabel(detail.deployment.trigger)}
			status={detail.bannerInput.status}
			timestamp={detail.infoTimestamp}
			lastUpdate={detail.lastUpdateTimestamp}
		/>

		<h2 class="font-montserrat-semibold py-2 text-base">Timeline</h2>
		{#if detail.eventsError}
			<EmptyState
				icon={CircleAlert}
				tone="failed"
				title={detail.eventsError.title}
				description={detail.eventsError.description}
				class="col-span-full border-none bg-transparent shadow-none"
			>
				{#snippet action()}
					{#if detail.eventsError?.showRetry}
						<button
							type="button"
							class={retryButtonClass}
							onclick={() => detail.deploymentEventsQuery.refetch()}
						>
							<RotateCcw class="h-6 w-6" />
							Coba lagi
						</button>
					{/if}
				{/snippet}
			</EmptyState>
		{:else}
			<DeploymentTimeline steps={detail.steps} showSubtitle emphasizeRunning />
		{/if}

		<h2 id="deployment-logs" class="font-montserrat-semibold py-2 text-base">Logs</h2>
		<DeploymentLogConsole lines={mockLogs.running} autoScroll />
	</div>
{:else}
	<EmptyState
		icon={CircleAlert}
		tone="muted"
		title="Deployment tidak tersedia"
		description="Data deployment ini belum bisa ditampilkan. Coba muat ulang halaman."
		class="col-span-full border-none bg-transparent shadow-none"
	/>
{/if}

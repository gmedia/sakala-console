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
</script>

{#if detail.isLoading}
	<EmptyState
		icon={CircleAlert}
		tone="muted"
		title="Memuat detail deployment..."
		description="Harap tunggu, ini mungkin memakan waktu beberapa detik."
		class="col-span-full border-none bg-transparent shadow-none"
	/>
{:else if detail.deploymentError}
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
					class="inline-flex cursor-pointer gap-2 rounded-lg border border-muted/20 bg-primary px-4 py-3 font-montserrat-semibold text-white"
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
		{#if detail.deployment}
			<DeploymentLiveAnnouncement status={detail.bannerInput.status} />

			<DeploymentStatusBanner {...detail.bannerInput} />
		{/if}

		<DeploymentInfoRow
			commitSha={detail.deployment.commit_sha ?? '-'}
			branch={detail.deployment.branch}
			trigger={getDeploymentTriggerLabel(detail.deployment.trigger)}
			status={detail.bannerInput.status}
			timestamp={detail.infoTimestamp}
			lastUpdate={detail.lastUpdateTimestamp}
		/>

		<p class="font-montserrat-semibold py-2">Timeline</p>
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
							class="inline-flex cursor-pointer gap-2 rounded-lg border border-muted/20 bg-primary px-4 py-3 font-montserrat-semibold text-white"
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

		<p class="font-montserrat-semibold py-2">Logs</p>
		<DeploymentLogConsole lines={mockLogs.running} autoScroll />
	</div>
{/if}

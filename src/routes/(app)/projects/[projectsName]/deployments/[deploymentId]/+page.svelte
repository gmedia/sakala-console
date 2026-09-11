<script lang="ts">
	import { page } from '$app/state';
	import DeploymentStatusBanner from '$lib/features/deployments/components/DeploymentStatusBanner.svelte';
	import DeploymentInfoRow from '$lib/features/deployments/components/DeploymentInfoRow.svelte';
	import DeploymentTimeline from '$lib/features/deployments/components/DeploymentTimeline.svelte';
	import DeploymentLogConsole from '$lib/features/deployments/components/DeploymentLogConsole.svelte';
	import { mockDeploymentDetail } from '$lib/features/deployments/mock/deployment';
	import { mockTimelineEvents, mockLogs } from '$lib/features/deployments/mock/events';
	import type { BannerStatus } from '$lib/features/deployments/status-config';

	let status = $derived((page.url.searchParams.get('status') as BannerStatus) ?? 'running');
	let deployment = $derived(mockDeploymentDetail[status]);
	let steps = $derived(mockTimelineEvents[status]);
	let lines = $derived(mockLogs[status]);
</script>

<svelte:head><title>Detail Deployment | Sakala Console</title></svelte:head>

<DeploymentStatusBanner
	{status}
	currentStepLabel={deployment.currentStepLabel}
	durationLabel={deployment.durationLabel}
	failedStepLabel={deployment.failedStepLabel}
/>

<DeploymentInfoRow
	commitHash={deployment.commitHash}
	branch={deployment.branch}
	trigger={deployment.trigger}
	{status}
	timestamp={deployment.timestamp}
/>

<p class="font-montserrat-semibold py-2">Timeline</p>
<DeploymentTimeline {steps} />

<p class="font-montserrat-semibold py-2">Logs</p>
<DeploymentLogConsole {lines} autoScroll />

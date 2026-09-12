<script lang="ts">
	import { page } from '$app/state';
	import {
		streamDeploymentProgress,
		resolveDeployScenario,
		type DeployScenario
	} from '$lib/features/projects/mock/mockDeployment';
	import {
		deriveBannerState,
		parseBannerStatus,
		type StatusDisplayInput
	} from '$lib/features/deployments/status-config';
	import type { DeploymentStep, DeployLogLine } from '$lib/features/deployments/type';
	import { mockDeploymentDetail } from '$lib/features/deployments/mock/deployment';
	import { mockTimelineEvents, mockLogs } from '$lib/features/deployments/mock/events';
	import DeploymentStatusBanner from '$lib/features/deployments/components/DeploymentStatusBanner.svelte';
	import DeploymentInfoRow from '$lib/features/deployments/components/DeploymentInfoRow.svelte';
	import DeploymentTimeline from '$lib/features/deployments/components/DeploymentTimeline.svelte';
	import DeploymentLogConsole from '$lib/features/deployments/components/DeploymentLogConsole.svelte';

	let queryStatus = $derived(page.url.searchParams.get('status'));
	let isLive = $derived(page.url.searchParams.get('live') === '1');

	let staticStatus = $derived(parseBannerStatus(queryStatus, 'running'));
	let staticDeployment = $derived(mockDeploymentDetail[staticStatus]);

	let liveSteps = $state<DeploymentStep[]>([]);
	let liveLines = $state<DeployLogLine[]>([]);
	let liveBannerInput = $state<StatusDisplayInput>({ status: 'running' });

	$effect(() => {
		if (!isLive) return;

		const scenario: DeployScenario =
			queryStatus === 'failed'
				? 'failed'
				: queryStatus === 'success'
					? 'success'
					: resolveDeployScenario();
		const startedAt = Date.now();
		let cancelled = false;

		(async () => {
			for await (const progress of streamDeploymentProgress(scenario)) {
				if (cancelled) return;
				liveSteps = progress.steps;
				liveLines = progress.logs;
				liveBannerInput = deriveBannerState(progress, Math.round((Date.now() - startedAt) / 1000));
			}
		})();

		return () => {
			cancelled = true;
		};
	});

	let bannerInput = $derived(
		isLive
			? liveBannerInput
			: {
					status: staticStatus,
					currentStepLabel: staticDeployment.current_step_label,
					durationLabel: staticDeployment.duration_label,
					failedStepLabel: staticDeployment.failed_step_label
				}
	);
	let infoTimestamp = $derived(
		bannerInput.status === 'running'
			? staticDeployment.started_at
			: (staticDeployment.finished_at ?? '-')
	);
	let steps = $derived(isLive ? liveSteps : mockTimelineEvents[staticStatus]);
	let lines = $derived(isLive ? liveLines : mockLogs[staticStatus]);
</script>

<div class="px-6">
	<DeploymentStatusBanner {...bannerInput} />

	<DeploymentInfoRow
		commitHash={staticDeployment.commit_hash}
		branch={staticDeployment.branch}
		trigger={staticDeployment.trigger}
		status={bannerInput.status}
		timestamp={infoTimestamp}
	/>

	<p class="font-montserrat-semibold py-2">Timeline</p>
	<DeploymentTimeline {steps} showSubtitle emphasizeRunning />

	<p class="font-montserrat-semibold py-2">Logs</p>
	<DeploymentLogConsole {lines} autoScroll />
</div>

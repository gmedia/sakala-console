<script lang="ts">
	import { useDeploymentDetail } from '$lib/features/deployments/use-deployment-detail.svelte';
	import { useProjectLiveStatus } from '$lib/features/projects/detail/use-project-live-status.svelte';
	import { deriveProjectHeaderState } from '$lib/features/projects/presentation';
	import { createProjectQuery, createRecentDeploymentsQuery } from '$lib/features/projects/queries';
	import type { Project } from '$lib/features/projects/type';

	type Props = { projectId: string; deploymentId: string; fallback: Project };

	let { projectId, deploymentId, fallback }: Props = $props();

	// What the deployment page reads, together with the project layout around it.
	const projectQuery = createProjectQuery(() => projectId, { poll: true });
	const detail = useDeploymentDetail(
		() => projectId,
		() => deploymentId
	);
	useProjectLiveStatus(() => projectQuery.data ?? fallback);
	const recent = createRecentDeploymentsQuery(() => projectId);
	const pageState = $derived(
		detail.project ? deriveProjectHeaderState(detail.project, recent.data?.data ?? []) : null
	);
</script>

<p data-testid="status">{detail.deployment?.status}</p>
<p data-testid="failure-code">{detail.bannerInput.failureCode ?? ''}</p>
<p data-testid="redeploy-busy">{String(pageState?.redeployBusy ?? '')}</p>

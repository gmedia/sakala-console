<script lang="ts">
	import { useDeploymentDetail } from '$lib/features/deployments/use-deployment-detail.svelte';
	import { useDeploymentLogs } from '$lib/features/deployments/use-deployment-logs.svelte';
	import { createUnreadNotificationCountQuery } from '$lib/features/notifications/queries';
	import { useProjectLiveStatus } from '$lib/features/projects/detail/use-project-live-status.svelte';
	import { createProjectQuery } from '$lib/features/projects/queries';
	import type { Project } from '$lib/features/projects/type';

	type Props = { projectId: string; deploymentId: string; fallback: Project };

	let { projectId, deploymentId, fallback }: Props = $props();

	// What the deployment page runs, together with the project layout and the bell around it.
	const projectQuery = createProjectQuery(() => projectId, { poll: true });
	const detail = useDeploymentDetail(
		() => projectId,
		() => deploymentId
	);
	useDeploymentLogs(
		() => projectId,
		() => deploymentId,
		() => ['succeeded', 'failed', 'cancelled'].includes(detail.deployment?.status ?? '')
	);
	const live = useProjectLiveStatus(() => projectQuery.data ?? fallback);
	createUnreadNotificationCountQuery();
</script>

<p data-testid="status">{detail.deployment?.status}</p>
<p data-testid="steps">{detail.steps.length}</p>
<p data-testid="header">{live.header.kind}</p>

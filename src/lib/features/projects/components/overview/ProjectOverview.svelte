<script lang="ts">
	import { SAKALA_EDGE_IN_FRONT } from '$lib/config/project';
	import { useProjectAccess } from '$lib/features/workspaces/access.svelte';
	import {
		createEnvironmentVariablesQuery,
		createProjectQuery,
		createRecentDeploymentsQuery
	} from '../../queries';
	import { deriveProjectHeaderState, getProjectPublicUrl } from '../../presentation';
	import { deriveNextSteps } from '../../overview/next-steps';
	import {
		deriveTopology,
		getAddressAvailability,
		type VariablesState
	} from '../../overview/topology';
	import { useDismissedSteps } from '../../overview/use-dismissed-steps.svelte';
	import DomainCard from './DomainCard.svelte';
	import NextStepsCard from './NextStepsCard.svelte';
	import OverviewMetricsCard from './OverviewMetricsCard.svelte';
	import RecentDeploymentsCard from './RecentDeploymentsCard.svelte';
	import TopologyCard from './TopologyCard.svelte';

	let { projectId }: { projectId: string } = $props();

	// The project and the recent deployments are the header's own queries, so they cost nothing here.
	const projectQuery = createProjectQuery(() => projectId);
	const recentQuery = createRecentDeploymentsQuery(() => projectId);
	const variablesQuery = createEnvironmentVariablesQuery(() => projectId);
	const access = useProjectAccess(() => projectQuery.data);
	const dismissed = useDismissedSteps(() => projectId);

	const project = $derived(projectQuery.data);
	// The same reading the header shows, so the diagram never disagrees with the badge above it.
	const header = $derived(
		project ? deriveProjectHeaderState(project, recentQuery.data?.data ?? []) : null
	);
	const variables = $derived.by((): VariablesState => {
		if (variablesQuery.data) return { state: 'ready', count: variablesQuery.data.length };
		return variablesQuery.isError ? { state: 'error' } : { state: 'loading' };
	});
	const topology = $derived(
		project && header
			? deriveTopology(project, header, variables, { edge: SAKALA_EDGE_IN_FRONT })
			: null
	);
	const steps = $derived(
		project
			? deriveNextSteps(
					project,
					{ variablesCount: variablesQuery.data?.length ?? null, readOnly: access.readOnly },
					dismissed.ids
				)
			: []
	);
	const address = $derived(
		project && header ? getAddressAvailability(project, header) : { reachable: false, note: null }
	);
</script>

{#if project && header && topology}
	<div class="flex w-full min-w-0 flex-col gap-4" data-testid="project-overview">
		<TopologyCard {projectId} {topology} />

		<div class="@container">
			<div class="grid gap-4 @4xl:grid-cols-3">
				<div class="flex min-w-0 flex-col gap-4 @4xl:col-span-2">
					<OverviewMetricsCard {projectId} runtimeStatus={project.runtime_status} />
					<RecentDeploymentsCard {projectId} />
				</div>
				<div class="flex min-w-0 flex-col gap-4">
					<DomainCard
						publicUrl={getProjectPublicUrl(project)}
						defaultDomain={project.default_domain}
						reachable={address.reachable}
						unreachableNote={address.note}
					/>
					<NextStepsCard {projectId} {steps} onDismiss={dismissed.dismiss} />
				</div>
			</div>
		</div>
	</div>
{:else if projectQuery.isPending}
	<div class="flex flex-col gap-4" role="status">
		<span class="sr-only">Memuat ringkasan proyek...</span>
		<div class="skeleton h-48 w-full rounded-card" aria-hidden="true"></div>
		<div class="skeleton h-40 w-full rounded-card" aria-hidden="true"></div>
	</div>
{/if}

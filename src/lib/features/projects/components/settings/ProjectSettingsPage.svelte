<script lang="ts">
	import FormPageLayout from '$lib/components/layout/templates/FormPageLayout.svelte';
	import PanelHelp from '$lib/components/panel/PanelHelp.svelte';
	import PanelNextSteps from '$lib/components/panel/PanelNextSteps.svelte';
	import { customDomainsEnabled, DOMAIN_COPY } from '$lib/features/domains/presentation';
	import { useWorkloadAvailability } from '$lib/features/workloads/availability.svelte';
	import ProcessesSection from '$lib/features/workloads/components/ProcessesSection.svelte';
	import SchedulesSection from '$lib/features/workloads/components/SchedulesSection.svelte';
	import { PROCESS_COPY } from '$lib/features/workloads/processes';
	import { SCHEDULE_COPY } from '$lib/features/workloads/schedules';
	import { useProjectAccess } from '$lib/features/workspaces/access.svelte';
	import { pageTitle } from '$lib/utils/page-title';
	import {
		createProjectDetailState,
		getProjectDetailContext
	} from '../../detail/projectDetailState.svelte';
	import { useSettingsSteps } from '../../detail/use-settings-steps.svelte';
	import { REDEPLOY_REQUIRED_COPY } from '../../presentation';
	import { createProjectQuery } from '../../queries';
	import {
		dirtySettingsPages,
		SETTINGS_PAGES,
		settingsSectionOf,
		settingsSections,
		type SettingsPage
	} from '../../settings-anchors';
	import { SETTINGS_HELP_LINKS, SETTINGS_PANEL_COPY } from '../../settings-panel';
	import ProjectDangerZone from '../detail/ProjectDangerZone.svelte';
	import ProjectSettingsForm from '../detail/ProjectSettingsForm.svelte';
	import RedeployRequiredNotice from '../detail/RedeployRequiredNotice.svelte';
	import ProjectSettingsNav from './ProjectSettingsNav.svelte';

	type Props = { projectId: string; page: SettingsPage };

	let { projectId, page }: Props = $props();

	const projectQuery = createProjectQuery(() => projectId);
	const project = $derived(projectQuery.data);
	const access = useProjectAccess(() => project);
	// Workers and schedules (ADR-022) and custom domains (ADR-024) appear only where the
	// installation turned them on, read from the workspace's limits.
	const workloads = useWorkloadAvailability(() => project);
	const domainsOn = $derived(customDomainsEnabled(workloads.limits));
	// The domain section carries the Public Suffix List, which no other page needs.
	const loadDomainsSection = () =>
		import('$lib/features/domains/components/ProjectDomainsSection.svelte');

	// Deleting is for those who may change settings, so a viewer is not offered the page.
	const sections = $derived(
		settingsSections({
			workers: workloads.workers,
			schedules: workloads.schedules,
			domains: domainsOn
		}).filter((section) => section.page !== SETTINGS_PAGES.danger || !access.readOnly)
	);
	const section = $derived(settingsSectionOf(page));
	const framework = $derived(project?.stack?.framework ?? null);

	const draft = getProjectDetailContext() ?? createProjectDetailState();
	const unsaved = $derived(dirtySettingsPages(draft.changedFields));

	const nextSteps = useSettingsSteps(
		() => project,
		() => ({
			limits: workloads.limits,
			workers: workloads.workers,
			schedules: workloads.schedules
		})
	);
	const helpLinks = $derived(SETTINGS_HELP_LINKS[page]);
	const hasPanel = $derived(nextSteps.steps.length > 0 || helpLinks.length > 0);
</script>

<svelte:head>
	<title>{pageTitle(`Pengaturan · ${section.label}`, project?.name)}</title>
</svelte:head>

{#snippet panel()}
	<PanelNextSteps steps={nextSteps.steps} testid="settings-next-steps" />
	{#if helpLinks.length > 0}
		<PanelHelp links={helpLinks} testid="settings-help" />
	{/if}
{/snippet}

{#snippet unavailable(text: string, testid: string)}
	<p class="surface-card p-4 text-sm text-muted sm:p-6" data-testid={testid}>{text}</p>
{/snippet}

{#snippet waiting(label: string)}
	<div class="skeleton h-40 w-full rounded-card" role="status" aria-label={label}></div>
{/snippet}

<div class="flex flex-col gap-4">
	<ProjectSettingsNav {projectId} {sections} current={page} {unsaved} />

	{#if project?.redeploy_required && !access.readOnly}
		<RedeployRequiredNotice {project} message={REDEPLOY_REQUIRED_COPY.settings} />
	{/if}

	<!-- The form template: this page's part of the settings left, its next steps and guides right. -->
	<FormPageLayout
		panelLabel={SETTINGS_PANEL_COPY.label}
		panel={project && hasPanel ? panel : undefined}
	>
		{#if page === SETTINGS_PAGES.general || page === SETTINGS_PAGES.build}
			<ProjectSettingsForm {projectId} formPage={page} />
		{:else if projectQuery.isLoading}
			{@render waiting(SETTINGS_PANEL_COPY.loading(section.label))}
		{:else if projectQuery.isError || !project}
			<p class="p-6 text-center text-sm text-error">{SETTINGS_PANEL_COPY.loadFailed}</p>
		{:else if page === SETTINGS_PAGES.danger}
			{#if access.readOnly}
				{@render unavailable(SETTINGS_PANEL_COPY.dangerReadOnly, 'danger-read-only')}
			{:else}
				<ProjectDangerZone {project} />
			{/if}
		{:else if !workloads.settled}
			{@render waiting(SETTINGS_PANEL_COPY.loading(section.label))}
		{:else if page === SETTINGS_PAGES.domains}
			{#if domainsOn}
				{#await loadDomainsSection()}
					{@render waiting(SETTINGS_PANEL_COPY.loading('Domain'))}
				{:then { default: ProjectDomainsSection }}
					<ProjectDomainsSection
						{projectId}
						defaultDomain={project.default_domain ?? null}
						limits={workloads.limits}
						readOnly={access.readOnly}
					/>
				{:catch}
					{@render unavailable(DOMAIN_COPY.sectionLoadFailed, 'domains-unavailable')}
				{/await}
			{:else}
				{@render unavailable(DOMAIN_COPY.unavailable, 'domains-unavailable')}
			{/if}
		{:else if page === SETTINGS_PAGES.processes}
			{#if workloads.workers}
				<ProcessesSection
					{projectId}
					{framework}
					liveDeploymentId={project.active_deployment_id}
					limits={workloads.limits}
					readOnly={access.readOnly}
				/>
			{:else}
				{@render unavailable(PROCESS_COPY.unavailable, 'processes-unavailable')}
			{/if}
		{:else if page === SETTINGS_PAGES.schedules}
			{#if workloads.schedules}
				<SchedulesSection
					{projectId}
					{framework}
					limits={workloads.limits}
					readOnly={access.readOnly}
				/>
			{:else}
				{@render unavailable(SCHEDULE_COPY.unavailable, 'schedules-unavailable')}
			{/if}
		{/if}
	</FormPageLayout>
</div>

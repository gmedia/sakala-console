<script lang="ts">
	import type { PilotLimits } from '$lib/api/resources/pilot-limits';
	import PanelHelp from '$lib/components/panel/PanelHelp.svelte';
	import PanelNextSteps from '$lib/components/panel/PanelNextSteps.svelte';
	import PanelSummary from '$lib/components/panel/PanelSummary.svelte';
	import SummaryRow from '$lib/components/panel/SummaryRow.svelte';
	import { PANEL_COPY } from '$lib/components/panel/panel';
	import Badge from '$lib/components/ui/Badge.svelte';
	import BreakableUrl from '$lib/components/ui/BreakableUrl.svelte';
	import { useProjectCustomDomains } from '$lib/features/domains/availability.svelte';
	import { domainQuota } from '$lib/features/domains/presentation';
	import { createProcessesQuery, createSchedulesQuery } from '$lib/features/workloads/queries';
	import { useProjectAccess } from '$lib/features/workspaces/access.svelte';
	import { useProjectIdleWindow } from '../../detail/use-project-idle-window.svelte';
	import { useDismissedSteps } from '../../overview/use-dismissed-steps.svelte';
	import {
		deriveProjectHeaderState,
		getPortDisplay,
		getProjectPublicUrl,
		getPublicUrlLabel,
		servesStaticFiles
	} from '../../presentation';
	import { createRecentDeploymentsQuery } from '../../queries';
	import {
		deriveSettingsSteps,
		SETTINGS_HELP_LINKS,
		SETTINGS_PANEL_COPY as COPY
	} from '../../settings-panel';
	import type { Project } from '../../type';

	type Props = {
		project: Project;
		/** Unsaved changes in the form beside the panel. */
		isDirty: boolean;
		limits?: PilotLimits;
		workers: boolean;
		schedules: boolean;
	};

	let { project, isDirty, limits, workers, schedules }: Props = $props();

	// Viewers get the summary and the guides, without steps they could not take.
	const access = useProjectAccess(() => project);

	// Every query here is one the header or a section already holds, so the panel asks the API for
	// nothing new: TanStack Query shares them by key.
	const recentQuery = createRecentDeploymentsQuery(() => project.id);
	const idleWindow = useProjectIdleWindow(
		() => project,
		() => access.role !== null
	);
	const header = $derived(
		deriveProjectHeaderState(project, recentQuery.data?.data ?? [], {
			idleSleepMinutes: idleWindow.minutes
		})
	);
	const customDomains = useProjectCustomDomains(() => project);
	const processesQuery = createProcessesQuery(
		() => project.id,
		() => workers
	);
	const schedulesQuery = createSchedulesQuery(
		() => project.id,
		() => schedules
	);
	const dismissed = useDismissedSteps(() => project.id);

	const defaultUrl = $derived(getProjectPublicUrl(project));
	// An active custom domain is the address visitors use; the Sakala one stays reachable beside it.
	const address = $derived(
		customDomains.serving && defaultUrl ? `https://${customDomains.serving}` : defaultUrl
	);
	const port = $derived(getPortDisplay(project));
	const showPort = $derived(!servesStaticFiles(project));

	const steps = $derived(
		deriveSettingsSteps(project, {
			readOnly: access.readOnly,
			dismissed: dismissed.ids,
			domains: customDomains.domains,
			domainQuota: domainQuota(limits),
			processes: workers ? processesQuery.data : undefined,
			schedules: schedules ? schedulesQuery.data : undefined
		}).map((step) => ({ id: step.id, label: step.label, href: `#${step.anchor}` }))
	);
</script>

<PanelSummary testid="settings-summary">
	<SummaryRow label={COPY.status}>
		<Badge tone={header.badge.variant}>
			<span data-testid="settings-summary-status">{header.badge.label}</span>
		</Badge>
	</SummaryRow>

	<SummaryRow label={COPY.address} mono testid="settings-summary-address">
		{#if address}
			<a
				href={address}
				target="_blank"
				rel="external noopener noreferrer"
				class="inline-flex min-h-6 items-center text-primary-dark underline underline-offset-2"
			>
				<BreakableUrl text={getPublicUrlLabel(address)} /><span class="sr-only"
					>&nbsp;{PANEL_COPY.newTab}</span
				>
			</a>
		{:else}
			<span class="font-sans text-muted">{COPY.noAddress}</span>
		{/if}
	</SummaryRow>

	{#if defaultUrl && address !== defaultUrl}
		<SummaryRow label={COPY.sakalaAddress} mono>
			<BreakableUrl text={getPublicUrlLabel(defaultUrl)} />
		</SummaryRow>
	{/if}

	<SummaryRow label={COPY.branch} mono>{project.branch}</SummaryRow>

	{#if showPort}
		<SummaryRow label={COPY.port}>
			<span class="tabular-nums" data-testid="settings-summary-port">{port.current}</span>
			{#if port.next !== null}
				<Badge tone="info">{COPY.nextPort(port.next)}</Badge>
			{/if}
		</SummaryRow>
	{/if}

	{#if isDirty}
		<SummaryRow label={COPY.changes} testid="settings-summary-unsaved">
			<Badge tone="warning">{COPY.unsaved}</Badge>
			<span class="text-xs text-foreground/70">{COPY.unsavedNote}</span>
		</SummaryRow>
	{/if}
</PanelSummary>

<PanelNextSteps {steps} testid="settings-next-steps" />

<PanelHelp links={SETTINGS_HELP_LINKS} testid="settings-help" />

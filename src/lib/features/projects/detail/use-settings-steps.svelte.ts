import type { PilotLimits } from '$lib/api/resources/pilot-limits';
import type { PanelStep } from '$lib/components/panel/panel';
import { useProjectCustomDomains } from '$lib/features/domains/availability.svelte';
import { domainQuota } from '$lib/features/domains/presentation';
import { createProcessesQuery, createSchedulesQuery } from '$lib/features/workloads/queries';
import { useProjectAccess } from '$lib/features/workspaces/access.svelte';
import { settingsHref } from '../overview/links';
import { useDismissedSteps } from '../overview/use-dismissed-steps.svelte';
import { deriveSettingsSteps } from '../settings-panel';
import type { Project } from '../type';

/**
 * The settings pages' "Berikutnya": up to three steps that apply to the project now, each linking to
 * the page that holds it. Every query here is one a settings section or the project header already
 * holds, so the steps ask the API for nothing new: TanStack Query shares them by key.
 */
export function useSettingsSteps(
	project: () => Project | undefined,
	features: () => { limits?: PilotLimits; workers: boolean; schedules: boolean }
) {
	const access = useProjectAccess(project);
	const customDomains = useProjectCustomDomains(project);
	const projectId = () => project()?.id ?? '';
	const processesQuery = createProcessesQuery(projectId, () => features().workers);
	const schedulesQuery = createSchedulesQuery(projectId, () => features().schedules);
	const dismissed = useDismissedSteps(projectId);

	const steps = $derived.by<PanelStep[]>(() => {
		const current = project();
		if (!current) return [];
		const { limits, workers, schedules } = features();
		return deriveSettingsSteps(current, {
			readOnly: access.readOnly,
			dismissed: dismissed.ids,
			domains: customDomains.domains,
			domainQuota: domainQuota(limits),
			processes: workers ? processesQuery.data : undefined,
			schedules: schedules ? schedulesQuery.data : undefined
		}).map((step) => ({
			id: step.id,
			label: step.label,
			href: settingsHref(current.id, step.anchor)
		}));
	});

	return {
		get steps(): PanelStep[] {
			return steps;
		}
	};
}

import type { PilotLimits } from '$lib/api/resources/pilot-limits';
import type { PanelStep } from '$lib/components/panel/panel';
import { useProjectCustomDomains } from '$lib/features/domains/availability.svelte';
import { domainQuota } from '$lib/features/domains/presentation';
import { createProcessesQuery, createSchedulesQuery } from '$lib/features/workloads/queries';
import { useProjectAccess } from '$lib/features/workspaces/access.svelte';
import { settingsHref } from '../overview/links';
import { useDismissedSteps } from '../overview/use-dismissed-steps.svelte';
import { deriveSettingsSteps, hiddenSettingsStepCount } from '../settings-panel';
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

	const context = $derived.by(() => {
		const { limits, workers, schedules } = features();
		return {
			readOnly: access.readOnly,
			dismissed: dismissed.ids,
			domains: customDomains.domains,
			domainQuota: domainQuota(limits),
			processes: workers ? processesQuery.data : undefined,
			schedules: schedules ? schedulesQuery.data : undefined
		};
	});

	const steps = $derived.by<PanelStep[]>(() => {
		const current = project();
		if (!current) return [];
		return deriveSettingsSteps(current, context).map((step) => ({
			id: step.id,
			label: step.label,
			href: settingsHref(current.id, step.anchor)
		}));
	});
	const hiddenCount = $derived.by(() => {
		const current = project();
		return current ? hiddenSettingsStepCount(current, context) : 0;
	});

	return {
		get steps(): PanelStep[] {
			return steps;
		},
		/** Steps that would apply but were hidden, so the panel can offer them back. */
		get hiddenCount(): number {
			return hiddenCount;
		},
		dismiss: (id: string) => dismissed.dismiss(id),
		restore: () => dismissed.restore()
	};
}

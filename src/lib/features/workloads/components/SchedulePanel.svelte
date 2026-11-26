<script lang="ts">
	import type { ProjectSchedule } from '$lib/api/resources/schedules';
	import PanelHelp from '$lib/components/panel/PanelHelp.svelte';
	import PanelNextSteps from '$lib/components/panel/PanelNextSteps.svelte';
	import LearnMore from '$lib/components/ui/LearnMore.svelte';
	import { deriveScheduleSteps, SCHEDULE_PANEL_COPY as COPY } from '../schedule-panel';
	import { SCHEDULE_COPY } from '../schedules';

	/**
	 * Next steps and help only: the schedule's facts sit under its name. Schedules have no guide page
	 * yet, so Bantuan holds the folded explanations that used to sit on the page.
	 */
	type Props = { schedule: ProjectSchedule; canManage: boolean };

	let { schedule, canManage }: Props = $props();

	const steps = $derived(deriveScheduleSteps(schedule, canManage));
</script>

<PanelNextSteps {steps} testid="schedule-next-steps" />

<PanelHelp testid="schedule-help">
	<LearnMore topic={COPY.howItRuns} label={COPY.howItRuns}>
		<p>{SCHEDULE_COPY.introLearn}</p>
		<p>{SCHEDULE_COPY.commandLearn}</p>
	</LearnMore>
	<LearnMore topic={COPY.history} label={COPY.history}>
		<p>{SCHEDULE_COPY.historyKept}</p>
	</LearnMore>
</PanelHelp>

<script lang="ts">
	import Badge from '$lib/components/ui/Badge.svelte';
	import type { ProjectSchedule } from '$lib/api/resources/schedules';
	import { scheduleStateView } from '../schedules';

	type Props = {
		schedule: Pick<
			ProjectSchedule,
			'enabled' | 'paused_at' | 'pause_reason' | 'health' | 'consecutive_failures'
		>;
	};

	let { schedule }: Props = $props();

	const view = $derived(scheduleStateView(schedule));
</script>

<Badge tone={view.tone}>{view.label}</Badge>

<script lang="ts">
	import Trash from 'phosphor-svelte/lib/Trash';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { getErrorMessage } from '$lib/api/errors';
	import type { ProjectSchedule } from '$lib/api/resources/schedules';
	import Button from '$lib/components/ui/Button.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import { createDeleteScheduleMutation } from '../mutations';
	import { schedulesHref } from '../routes';
	import { SCHEDULE_PANEL_COPY as COPY } from '../schedule-panel';
	import { SCHEDULE_COPY } from '../schedules';

	/** Deleting the schedule: one line, last on the page, after the panel on a narrow screen. */
	type Props = { projectId: string; schedule: ProjectSchedule };

	let { projectId, schedule }: Props = $props();

	const deleteMutation = createDeleteScheduleMutation();

	let deleteOpen = $state(false);
	let deleteTrigger = $state<HTMLElement | null>(null);
	let deleteError = $state('');

	async function confirmDelete() {
		if (deleteMutation.isPending) return;
		deleteError = '';
		const name = schedule.name;
		try {
			await deleteMutation.mutateAsync({ projectId, scheduleId: schedule.id });
			deleteOpen = false;
			toast.success(SCHEDULE_COPY.deleted(name));
			await goto(schedulesHref(projectId));
		} catch (error) {
			deleteError = getErrorMessage(error, SCHEDULE_COPY.deleteFailed);
		}
	}
</script>

<section
	class="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-card border border-error/30 bg-surface p-4 sm:p-5"
	aria-labelledby="schedule-danger-title"
	data-testid="schedule-danger-zone"
>
	<div class="flex min-w-0 flex-1 basis-56 flex-col gap-1">
		<h2 id="schedule-danger-title" class="text-base text-error-dark">{COPY.dangerTitle}</h2>
		<p class="text-sm text-foreground">{COPY.dangerBody}</p>
	</div>
	<Button
		variant="danger"
		size="sm"
		bind:ref={deleteTrigger}
		onclick={() => {
			deleteError = '';
			deleteOpen = true;
		}}
		data-testid="delete-schedule"
	>
		<Trash size={16} aria-hidden="true" />
		{SCHEDULE_COPY.delete}
	</Button>
</section>

<Dialog
	bind:open={deleteOpen}
	title={SCHEDULE_COPY.deleteTitle(schedule.name)}
	description={SCHEDULE_COPY.deleteDescription}
	confirmLabel={SCHEDULE_COPY.delete}
	variant="destructive"
	loading={deleteMutation.isPending}
	returnFocus={() => deleteTrigger}
	onConfirm={confirmDelete}
>
	{#if deleteError}
		<p role="alert" class="text-sm text-error-dark">{deleteError}</p>
	{/if}
</Dialog>

<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { getFieldError } from '$lib/api/errors';
	import type { ProjectSchedule } from '$lib/api/resources/schedules';
	import FormField from '$lib/components/ui/FormField.svelte';
	import InlineEditor from '$lib/components/ui/InlineEditor.svelte';
	import { createSaveScheduleMutation } from '../mutations';
	import { SCHEDULE_PANEL_COPY as COPY } from '../schedule-panel';
	import {
		SCHEDULE_COPY,
		scheduleSaveErrorMessage,
		timeoutError,
		type ScheduleLimits
	} from '../schedules';

	/**
	 * The run's time limit, edited in place from "Ubah" beside it: a single field, rarely changed. The
	 * same check as the schedule form, the same request with only this field, and the API's own
	 * refusal on the field.
	 */
	type Props = {
		id: string;
		projectId: string;
		schedule: ProjectSchedule;
		limits: ScheduleLimits;
		onClose: () => void;
	};

	let { id, projectId, schedule, limits, onClose }: Props = $props();

	const saveMutation = createSaveScheduleMutation();

	// Starts from the saved limit; the editor opens fresh each time.
	// svelte-ignore state_referenced_locally
	let value = $state(String(schedule.timeout_seconds));
	let error = $state<string | null>(null);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		error = null;
		const problem = timeoutError(value, limits);
		if (problem) {
			error = problem;
			return;
		}
		const seconds = Number(value.trim());
		if (seconds === schedule.timeout_seconds) {
			onClose();
			return;
		}
		try {
			await saveMutation.mutateAsync({
				projectId,
				scheduleId: schedule.id,
				payload: { timeout_seconds: seconds }
			});
			toast.success(COPY.timeoutSaved(SCHEDULE_COPY.seconds(seconds)));
			onClose();
		} catch (failure) {
			error =
				getFieldError(failure, 'timeout_seconds') ??
				scheduleSaveErrorMessage(failure, SCHEDULE_COPY.saveFailed);
		}
	}
</script>

<InlineEditor
	{id}
	label={`Ubah ${COPY.timeoutSubject}`}
	onsubmit={submit}
	onCancel={onClose}
	pending={saveMutation.isPending}
	submitDisabled={value.trim() === String(schedule.timeout_seconds)}
	testid="schedule-timeout-editor"
>
	<FormField
		id={`${id}-input`}
		label={SCHEDULE_COPY.timeoutLabel}
		bind:value
		hint={SCHEDULE_COPY.timeoutHint(limits.maxTimeoutSeconds)}
		{error}
		inputmode="numeric"
		autocomplete="off"
		oninput={() => (error = null)}
	/>
</InlineEditor>

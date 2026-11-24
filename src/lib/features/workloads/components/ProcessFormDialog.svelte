<script lang="ts">
	import { toast } from 'svelte-sonner';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';
	import { ApiError, getErrorMessage } from '$lib/api/errors';
	import type { ProjectProcess } from '$lib/api/resources/processes';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import FormField from '$lib/components/ui/FormField.svelte';
	import { createSaveProcessMutation } from '../mutations';
	import {
		emptyProcessDraft,
		hasProcessDraftErrors,
		PROCESS_COPY,
		processDraftErrors,
		processDraftFrom,
		processErrorsFromApi,
		processPayload,
		type ProcessDraft,
		type ProcessDraftErrors
	} from '../processes';
	import { PROCESS_RULES } from '../rules';

	type Props = {
		open: boolean;
		projectId: string;
		/** The worker being changed; without it the dialog adds one. */
		process?: ProjectProcess | null;
		/** What a new worker starts with, for example the Laravel suggestion. */
		preset?: Pick<ProcessDraft, 'name' | 'command'> | null;
		/** Names of the project's workers, so a duplicate is caught before sending. */
		takenNames: readonly string[];
		maxReplicas: number;
		maxMemoryMb?: number;
		maxCpuMillis?: number;
		/** Said under the list once the dialog closes. */
		onSaved?: (message: string) => void;
	};

	let {
		open = $bindable(false),
		projectId,
		process = null,
		preset = null,
		takenNames,
		maxReplicas,
		maxMemoryMb,
		maxCpuMillis,
		onSaved
	}: Props = $props();

	const saveMutation = createSaveProcessMutation();
	const uid = $props.id();
	const ids = {
		form: `${uid}-form`,
		name: `${uid}-name`,
		command: `${uid}-command`,
		replicas: `${uid}-replicas`,
		memory: `${uid}-memory`,
		cpu: `${uid}-cpu`,
		resources: `${uid}-resources`
	};

	let draft = $state<ProcessDraft>(emptyProcessDraft());
	let errors = $state<ProcessDraftErrors>({});
	let formError = $state('');
	let resourcesOpen = $state(false);
	// `isPending` flips a tick after mutate(), too late for a double click.
	let submitting = false;

	const otherNames = $derived(takenNames.filter((name) => name !== process?.name));

	$effect(() => {
		if (!open) return;
		draft = process ? processDraftFrom(process) : { ...emptyProcessDraft(), ...(preset ?? {}) };
		errors = {};
		formError = '';
		resourcesOpen = Boolean(process?.memory_mb || process?.cpu_millis);
	});

	function update(field: keyof ProcessDraft, value: string) {
		draft[field] = value;
		errors[field] = undefined;
		formError = '';
	}

	async function handleSave() {
		if (submitting) return;
		errors = processDraftErrors(draft, {
			maxReplicas,
			maxMemoryMb,
			maxCpuMillis,
			takenNames: otherNames
		});
		if (errors.memory_mb || errors.cpu_millis) resourcesOpen = true;
		if (hasProcessDraftErrors(errors)) return;

		const payload = processPayload(draft, process ?? undefined);
		if (process && Object.keys(payload).length === 0) {
			open = false;
			return;
		}

		submitting = true;
		try {
			const saved = await saveMutation.mutateAsync({
				projectId,
				processId: process?.id,
				payload
			});
			open = false;
			const message = PROCESS_COPY.saved(saved.name);
			toast.success(message);
			onSaved?.(message);
		} catch (error) {
			if (
				error instanceof ApiError &&
				error.isValidationError &&
				Object.keys(error.errors).length
			) {
				errors = processErrorsFromApi(error.errors);
				if (errors.memory_mb || errors.cpu_millis) resourcesOpen = true;
				if (hasProcessDraftErrors(errors)) return;
			}
			formError = getErrorMessage(error, PROCESS_COPY.saveFailed);
		} finally {
			submitting = false;
		}
	}
</script>

<Dialog
	bind:open
	title={process ? PROCESS_COPY.editTitle(process.name) : PROCESS_COPY.addTitle}
	description={PROCESS_COPY.applies}
	descriptionClass="text-muted"
	class="max-w-lg"
	confirmLabel={saveMutation.isPending ? PROCESS_COPY.saving : PROCESS_COPY.save}
	loading={saveMutation.isPending}
	initialFocus={() => document.getElementById(process ? ids.command : ids.name)}
	onConfirm={handleSave}
>
	<form
		id={ids.form}
		class="flex flex-col gap-4"
		novalidate
		onsubmit={(event) => {
			event.preventDefault();
			void handleSave();
		}}
	>
		<FormField
			id={ids.name}
			label={PROCESS_COPY.nameLabel}
			hint={PROCESS_COPY.nameHint}
			placeholder="queue"
			spellcheck={false}
			autocomplete="off"
			inputClass="font-mono"
			bind:value={() => draft.name, (value) => update('name', value)}
			error={errors.name}
		/>
		<FormField
			id={ids.command}
			label={PROCESS_COPY.commandLabel}
			hint={PROCESS_COPY.commandHint}
			placeholder="php artisan queue:work"
			spellcheck={false}
			autocomplete="off"
			inputClass="font-mono"
			bind:value={() => draft.command, (value) => update('command', value)}
			error={errors.command}
		/>

		<div class="space-y-1.5">
			<label for={ids.replicas} class="block text-sm font-medium text-foreground"
				>{PROCESS_COPY.replicasLabel}</label
			>
			<!-- A number input binds a number, or null when emptied, so it goes back to text here. -->
			<input
				id={ids.replicas}
				type="number"
				inputmode="numeric"
				min={PROCESS_RULES.minReplicas}
				max={maxReplicas}
				step="1"
				bind:value={
					() => draft.replicas,
					(next: number | string | null) => update('replicas', String(next ?? ''))
				}
				aria-invalid={errors.replicas ? 'true' : undefined}
				aria-describedby={errors.replicas ? `${ids.replicas}-error` : `${ids.replicas}-hint`}
				class="control-input max-w-32 tabular-nums"
			/>
			{#if errors.replicas}
				<p id={`${ids.replicas}-error`} class="text-xs text-error-base">{errors.replicas}</p>
			{:else}
				<p id={`${ids.replicas}-hint`} class="text-xs text-foreground/70">
					{PROCESS_COPY.replicasHint(maxReplicas)}
				</p>
			{/if}
		</div>

		<div class="border-t border-border pt-3">
			<button
				type="button"
				class="flex min-h-control-lg w-full cursor-pointer items-center justify-between gap-2 rounded-control text-left text-sm font-medium text-foreground lg:min-h-control-md"
				aria-expanded={resourcesOpen}
				aria-controls={ids.resources}
				onclick={() => (resourcesOpen = !resourcesOpen)}
			>
				<span>{PROCESS_COPY.resourcesToggle}</span>
				<CaretDown
					size={16}
					class={resourcesOpen ? 'shrink-0 rotate-180' : 'shrink-0'}
					aria-hidden="true"
				/>
			</button>
			<div id={ids.resources} class="mt-3 flex flex-col gap-4" hidden={!resourcesOpen}>
				<p class="text-xs text-foreground/70">{PROCESS_COPY.resourcesHint}</p>
				<FormField
					id={ids.memory}
					label={PROCESS_COPY.memoryLabel}
					hint={maxMemoryMb ? PROCESS_COPY.resourceMax(maxMemoryMb, 'MB') : undefined}
					placeholder={PROCESS_COPY.followsProject}
					inputmode="numeric"
					bind:value={() => draft.memory_mb, (value) => update('memory_mb', value)}
					error={errors.memory_mb}
				/>
				<FormField
					id={ids.cpu}
					label={PROCESS_COPY.cpuLabel}
					hint={maxCpuMillis ? PROCESS_COPY.resourceMax(maxCpuMillis, 'millicore') : undefined}
					placeholder={PROCESS_COPY.followsProject}
					inputmode="numeric"
					bind:value={() => draft.cpu_millis, (value) => update('cpu_millis', value)}
					error={errors.cpu_millis}
				/>
			</div>
		</div>

		{#if formError}
			<p role="alert" class="text-sm text-error-dark">{formError}</p>
		{/if}
		<!-- Enter in a field submits; the dialog's own button does the same. -->
		<button type="submit" hidden>{PROCESS_COPY.save}</button>
	</form>
</Dialog>

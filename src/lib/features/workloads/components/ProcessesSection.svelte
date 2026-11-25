<script lang="ts">
	import { tick } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { page } from '$app/state';
	import Lightbulb from 'phosphor-svelte/lib/Lightbulb';
	import PencilSimple from 'phosphor-svelte/lib/PencilSimple';
	import Plus from 'phosphor-svelte/lib/Plus';
	import Trash from 'phosphor-svelte/lib/Trash';
	import { getErrorMessage } from '$lib/api/errors';
	import type { PilotLimits } from '$lib/api/resources/pilot-limits';
	import type { ProjectProcess } from '$lib/api/resources/processes';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import LearnMore from '$lib/components/ui/LearnMore.svelte';
	import { SETTINGS_SECTION_IDS } from '$lib/features/projects/settings-anchors';
	import { createDeleteProcessMutation } from '../mutations';
	import {
		PROCESS_COPY,
		processCrashText,
		processResourcesText,
		processSuggestion,
		workerQuota,
		workerQuotaText,
		type ProcessDraft
	} from '../processes';
	import { createProcessesQuery, isFeatureOffError } from '../queries';
	import { PROCESS_RULES, WEB_PROCESS } from '../rules';
	import { processLogHref } from '../routes';
	import { DISPLAY_TIMEZONE } from '../time';
	import ProcessFormDialog from './ProcessFormDialog.svelte';

	type Props = {
		projectId: string;
		/** The detected framework, for the Laravel suggestion. */
		framework?: string | null;
		/** The serving deployment, whose log a crashing worker's link opens. */
		liveDeploymentId?: string | null;
		limits?: PilotLimits;
		/** Viewers read the list without the controls the API would refuse them. */
		readOnly: boolean;
	};

	let { projectId, framework = null, liveDeploymentId = null, limits, readOnly }: Props = $props();

	const sectionId = SETTINGS_SECTION_IDS.processes;
	const processesQuery = createProcessesQuery(
		() => projectId,
		() => true
	);
	const deleteMutation = createDeleteProcessMutation();

	const processes = $derived(processesQuery.data ?? []);
	const quota = $derived(workerQuota(limits, processes));
	const suggestion = $derived(readOnly ? null : processSuggestion(framework, processes));
	const atMaximum = $derived(processes.length >= PROCESS_RULES.maxPerProject);
	// The quota is status: shown while it stops something, otherwise one click away.
	const quotaBlocks = $derived(quota !== null && (quota.max === 0 || quota.current >= quota.max));
	const maxReplicas = $derived(limits?.quotas.max_replicas ?? PROCESS_RULES.defaultReplicas);

	let formOpen = $state(false);
	let editing = $state<ProjectProcess | null>(null);
	let preset = $state<Pick<ProcessDraft, 'name' | 'command'> | null>(null);
	let removing = $state<ProjectProcess | null>(null);
	let deleteError = $state('');
	let statusMessage = $state('');

	function openCreate(from: Pick<ProcessDraft, 'name' | 'command'> | null = null) {
		editing = null;
		preset = from;
		formOpen = true;
	}

	function openEdit(process: ProjectProcess) {
		editing = process;
		preset = null;
		formOpen = true;
	}

	async function confirmDelete() {
		const process = removing;
		if (!process || deleteMutation.isPending) return;
		deleteError = '';
		try {
			await deleteMutation.mutateAsync({ projectId, processId: process.id });
			removing = null;
			statusMessage = PROCESS_COPY.deleted(process.name);
			toast.success(statusMessage);
		} catch (error) {
			deleteError = getErrorMessage(error, PROCESS_COPY.deleteFailed);
		}
	}

	// The section renders after the workspace's limits arrive, later than the page's own anchor
	// handling, so a link to #proses scrolls here itself once.
	let arrived = false;
	$effect(() => {
		if (arrived || processesQuery.isPending || page.url.hash !== `#${sectionId}`) return;
		arrived = true;
		void tick().then(() => document.getElementById(sectionId)?.scrollIntoView({ block: 'start' }));
	});
</script>

<section
	id={sectionId}
	aria-labelledby="{sectionId}-title"
	class="surface-card flex scroll-mt-4 flex-col gap-4 p-4 sm:p-6"
	data-testid="processes-section"
>
	<div class="flex flex-wrap items-start justify-between gap-3">
		<div class="min-w-0 flex-1 basis-64">
			<h2 id="{sectionId}-title" class="font-sans text-base font-semibold text-foreground">
				{PROCESS_COPY.section}
			</h2>
			<p class="mt-1 text-sm text-foreground/70">{PROCESS_COPY.intro}</p>
		</div>
		{#if !readOnly && processesQuery.isSuccess}
			<Button
				variant="secondary"
				onclick={() => openCreate()}
				disabled={atMaximum}
				aria-describedby={atMaximum ? `${sectionId}-maximum` : undefined}
			>
				<Plus size={16} aria-hidden="true" />
				{PROCESS_COPY.add}
			</Button>
		{/if}
	</div>

	{#if processesQuery.isPending}
		<div class="flex flex-col gap-2" role="status" aria-label="Memuat worker">
			<div class="skeleton h-16 w-full"></div>
			<div class="skeleton h-16 w-full"></div>
		</div>
	{:else if processesQuery.isError}
		<p class="text-sm text-muted" data-testid="processes-unavailable">
			{isFeatureOffError(processesQuery.error) ? PROCESS_COPY.unavailable : PROCESS_COPY.loadFailed}
		</p>
	{:else}
		<ul class="flex flex-col divide-y divide-border rounded-control border border-border">
			<li class="flex flex-col gap-1 p-3 sm:p-4" data-testid="process-web">
				<div class="flex flex-wrap items-center gap-2">
					<span class="font-mono text-sm font-semibold text-foreground">{WEB_PROCESS}</span>
					<Badge tone="neutral">{PROCESS_COPY.webBadge}</Badge>
				</div>
				<p class="text-sm text-foreground/70">{PROCESS_COPY.webDescription}</p>
			</li>
			{#each processes as process (process.id)}
				<li class="flex flex-col gap-2 p-3 sm:p-4" data-testid="process-row">
					<div class="flex flex-wrap items-start justify-between gap-2">
						<div class="flex min-w-0 flex-wrap items-center gap-2">
							<span class="font-mono text-sm font-semibold wrap-anywhere text-foreground"
								>{process.name}</span
							>
							{#if process.crash}
								<Badge tone="error">
									{process.crash.running ? PROCESS_COPY.crashRecovering : PROCESS_COPY.crash}
								</Badge>
							{:else if process.replicas === 0}
								<Badge tone="muted">{PROCESS_COPY.notRunning}</Badge>
							{:else}
								<Badge tone="neutral">{PROCESS_COPY.containers(process.replicas)}</Badge>
							{/if}
						</div>
						{#if !readOnly}
							<div class="flex shrink-0 items-center gap-1">
								<Button
									variant="ghost"
									size="sm"
									onclick={() => openEdit(process)}
									aria-label="{PROCESS_COPY.edit} worker {process.name}"
								>
									<PencilSimple size={16} aria-hidden="true" />
									<span class="max-sm:sr-only">{PROCESS_COPY.edit}</span>
								</Button>
								<Button
									variant="ghost"
									size="sm"
									onclick={() => {
										deleteError = '';
										removing = process;
									}}
									aria-label="{PROCESS_COPY.delete} worker {process.name}"
								>
									<Trash size={16} aria-hidden="true" />
									<span class="max-sm:sr-only">{PROCESS_COPY.delete}</span>
								</Button>
							</div>
						{/if}
					</div>
					<code
						class="block rounded-control bg-background-soft px-2 py-1 font-mono text-xs wrap-anywhere text-foreground"
						>{process.command}</code
					>
					<p class="text-xs text-foreground/70">{processResourcesText(process)}</p>
					{#if process.crash}
						<p class="text-sm text-error-dark" data-testid="process-crash">
							{processCrashText(process.crash, DISPLAY_TIMEZONE)}.
							{#if liveDeploymentId}
								<!-- eslint-disable svelte/no-navigation-without-resolve -- resolved, plus a query -->
								<a
									href={processLogHref(projectId, liveDeploymentId, process.name)}
									class="font-medium text-primary-dark underline underline-offset-2"
									>Lihat log {process.name}</a
								>
								<!-- eslint-enable svelte/no-navigation-without-resolve -->
							{/if}
						</p>
					{/if}
				</li>
			{/each}
		</ul>

		{#if processes.length === 0}
			<div class="rounded-control border border-dashed border-border p-4 text-center">
				<p class="text-sm font-medium text-foreground">{PROCESS_COPY.emptyTitle}</p>
				<p class="mt-1 text-sm text-foreground/70">{PROCESS_COPY.emptyDescription}</p>
			</div>
		{/if}

		{#if suggestion}
			<div
				class="flex flex-col gap-3 rounded-control border border-primary/20 bg-primary-50 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4"
				data-testid="process-suggestion"
			>
				<div class="flex min-w-0 gap-2">
					<Lightbulb size={20} class="mt-0.5 shrink-0 text-primary-dark" aria-hidden="true" />
					<div class="min-w-0">
						<p class="text-sm font-medium text-foreground">{PROCESS_COPY.suggestionTitle}</p>
						<code class="font-mono text-xs wrap-anywhere text-foreground">{suggestion.command}</code
						>
					</div>
				</div>
				<Button
					variant="secondary"
					size="sm"
					onclick={() => openCreate(suggestion)}
					disabled={atMaximum}
				>
					{PROCESS_COPY.suggestionUse}
				</Button>
			</div>
		{/if}

		<div class="flex flex-col gap-1 text-xs text-foreground/70">
			{#if atMaximum && !readOnly}
				<p id="{sectionId}-maximum">{PROCESS_COPY.limitReached(PROCESS_RULES.maxPerProject)}</p>
			{/if}
			{#if quota && quotaBlocks}
				<p data-testid="worker-quota">{workerQuotaText(quota)}</p>
			{/if}
			<p>{readOnly ? PROCESS_COPY.readOnly : PROCESS_COPY.applies}</p>
		</div>
		<LearnMore topic="worker">
			<p>{PROCESS_COPY.introLearn}</p>
			{#if quota && !quotaBlocks}
				<p data-testid="worker-quota">{workerQuotaText(quota)}</p>
			{/if}
		</LearnMore>
		<span role="status" class="sr-only">{statusMessage}</span>
	{/if}
</section>

{#if !readOnly}
	<ProcessFormDialog
		bind:open={formOpen}
		{projectId}
		process={editing}
		{preset}
		takenNames={processes.map((process) => process.name)}
		{maxReplicas}
		maxMemoryMb={limits?.runtime_maximums?.memory_mb}
		maxCpuMillis={limits?.runtime_maximums?.cpu_millis}
		onSaved={(message) => (statusMessage = message)}
	/>

	<Dialog
		open={removing !== null}
		title={removing ? PROCESS_COPY.deleteTitle(removing.name) : ''}
		description={PROCESS_COPY.deleteDescription}
		confirmLabel={PROCESS_COPY.deleteConfirm}
		variant="destructive"
		loading={deleteMutation.isPending}
		onConfirm={confirmDelete}
		onCancel={() => (removing = null)}
	>
		{#if deleteError}
			<p role="alert" class="text-sm text-error-dark">{deleteError}</p>
		{/if}
	</Dialog>
{/if}

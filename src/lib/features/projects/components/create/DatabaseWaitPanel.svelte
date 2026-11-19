<script lang="ts">
	import Check from 'phosphor-svelte/lib/Check';
	import CircleNotch from 'phosphor-svelte/lib/CircleNotch';
	import WarningCircle from 'phosphor-svelte/lib/WarningCircle';
	import { provisioningSteps, type ProvisioningStep } from '$lib/features/databases/presentation';
	import { cn } from '$lib/utils/cn';
	import { WAITING_COPY, type DeployWhenReadyView } from '../../first-deploy/deploy-when-ready';
	import type { ProjectDatabase } from '../../type';

	/**
	 * While the database made for the project is created, and the API is to start the first deploy
	 * once it is ready. The steps are the ones the database page shows, plus the deploy, so the end
	 * is in sight (Goal-Gradient); there is no percentage, because the node does not report one.
	 */
	type Props = {
		database: ProjectDatabase;
		view: Exclude<DeployWhenReadyView, { kind: 'started' }>;
		/** Waited longer than usual: said honestly, without calling it failed. */
		slow?: boolean;
	};

	let { database, view, slow = false }: Props = $props();

	const steps = $derived<ProvisioningStep[]>([
		...provisioningSteps(database),
		{ label: WAITING_COPY.deployStep, state: 'pending' }
	]);

	const SR_STATE: Record<ProvisioningStep['state'], string> = {
		done: '(selesai)',
		current: '(sedang berjalan)',
		pending: '(belum)'
	};
</script>

{#if view.kind === 'waiting'}
	<!-- Polite, so each step that completes is heard without moving focus. -->
	<div
		class="flex flex-col gap-3 rounded-card border border-border bg-surface p-4"
		aria-live="polite"
		data-testid="database-wait"
	>
		<h3 class="font-sans text-base font-semibold">{WAITING_COPY.title}</h3>
		<p class="text-sm">{WAITING_COPY.body}</p>
		<ol class="flex flex-col gap-2" aria-label="Tahap sebelum deploy">
			{#each steps as step (step.label)}
				<li class="flex items-center gap-2 text-sm">
					<span
						class={cn(
							'flex size-5 shrink-0 items-center justify-center rounded-full',
							step.state === 'done' && 'bg-primary text-white',
							step.state === 'current' && 'text-primary-dark',
							step.state === 'pending' && 'border-2 border-border-strong'
						)}
						aria-hidden="true"
					>
						{#if step.state === 'done'}
							<Check size={12} weight="bold" />
						{:else if step.state === 'current'}
							<CircleNotch size={18} class="animate-spin motion-reduce:animate-none" />
						{/if}
					</span>
					<span class={step.state === 'pending' ? 'text-muted' : 'text-foreground'}>
						{step.label}
						<span class="sr-only">{SR_STATE[step.state]}</span>
					</span>
				</li>
			{/each}
		</ol>
		{#if slow}
			<p class="rounded-control border border-warning/40 bg-warning/10 p-3 text-sm">
				{WAITING_COPY.slow}
			</p>
		{/if}
	</div>
{:else}
	<div
		class="flex flex-col gap-2 rounded-card border border-warning/40 bg-warning/10 p-4"
		role="alert"
		data-testid="database-skipped"
	>
		<h3 class="flex items-center gap-2 font-sans text-base font-semibold">
			<WarningCircle class="size-5 shrink-0 text-warning-dark" aria-hidden="true" />
			{WAITING_COPY.skippedTitle}
		</h3>
		<p class="text-sm">{view.reason}</p>
	</div>
{/if}

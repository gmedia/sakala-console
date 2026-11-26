<script lang="ts">
	// Links come from resolveRoute() in ../routes.ts.
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { DeployIcon } from '$lib/components/icons';
	import CheckCircle from 'phosphor-svelte/lib/CheckCircle';
	import CircleNotch from 'phosphor-svelte/lib/CircleNotch';
	import Info from 'phosphor-svelte/lib/Info';
	import WarningCircle from 'phosphor-svelte/lib/WarningCircle';
	import type { DatabaseProjectRef, DatabaseRotationRedeploy } from '$lib/api/resources/databases';
	import Button from '$lib/components/ui/Button.svelte';
	import { createRedeployMutation } from '$lib/features/projects/mutations';
	import { getDeployErrorMessage } from '$lib/features/projects/presentation';
	import { createProjectQuery } from '$lib/features/projects/queries';
	import {
		ATTACHED_REDEPLOY_SKIPPED_REASONS,
		ROTATION_COPY,
		rotationProjectState,
		type RotationRowCopy
	} from '../presentation';
	import { projectDeploymentHref, projectHref } from '../routes';

	type Props = {
		project: DatabaseProjectRef;
		/** The API's outcome for this project, when the rotation asked for redeploys. */
		redeploy: DatabaseRotationRedeploy | undefined;
		canManage: boolean;
		copy?: RotationRowCopy;
		/** Why a redeploy was skipped, by `skipped_reason`. */
		skippedReasons?: Record<string, string>;
	};

	let {
		project,
		redeploy,
		canManage,
		copy = ROTATION_COPY,
		skippedReasons = ATTACHED_REDEPLOY_SKIPPED_REASONS
	}: Props = $props();

	const projectQuery = createProjectQuery(() => project.id);
	const redeployMutation = createRedeployMutation();

	// A redeploy started from this row, so the row links to it right away.
	let startedDeploymentId = $state<string | null>(null);
	let redeployError = $state<string | null>(null);

	const outcome = $derived.by(() => {
		if (startedDeploymentId) return { kind: 'queued' as const, deploymentId: startedDeploymentId };
		return rotationProjectState(redeploy, projectQuery.data, skippedReasons);
	});

	async function startRedeploy() {
		const branch = projectQuery.data?.branch;
		if (!branch) return;
		redeployError = null;
		try {
			const deployment = await redeployMutation.mutateAsync({ projectId: project.id, branch });
			startedDeploymentId = deployment.id;
		} catch (error) {
			redeployError = getDeployErrorMessage(error, copy.redeployFailed);
		}
	}
</script>

<li class="flex min-w-0 flex-col gap-2 px-4 py-3" data-testid={`rotation-project-${project.id}`}>
	<div class="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2">
		<div class="flex min-w-0 flex-col gap-0.5">
			<a
				href={projectHref(project.id)}
				class="min-h-6 min-w-0 text-sm font-medium wrap-anywhere text-foreground underline-offset-2 hover:underline"
			>
				{project.name}
			</a>
			<p class="flex min-w-0 items-start gap-1.5 text-sm text-foreground" data-state={outcome.kind}>
				{#if outcome.kind === 'queued'}
					<CircleNotch
						size={16}
						class="mt-0.5 shrink-0 animate-spin text-primary-dark motion-reduce:animate-none"
						aria-hidden="true"
					/>
					{copy.rowQueued}
				{:else if outcome.kind === 'done'}
					<CheckCircle size={16} class="mt-0.5 shrink-0 text-success-dark" aria-hidden="true" />
					{copy.rowDone}
				{:else if outcome.kind === 'first_deploy'}
					<Info size={16} class="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
					{copy.rowFirstDeploy}
				{:else if outcome.kind === 'needs_redeploy'}
					<WarningCircle size={16} class="mt-0.5 shrink-0 text-warning-dark" aria-hidden="true" />
					{copy.rowNeedsRedeploy}
				{:else}
					<span class="text-muted">Memuat status proyek...</span>
				{/if}
			</p>
		</div>
		{#if outcome.kind === 'queued'}
			<a
				href={projectDeploymentHref(project.id, outcome.deploymentId)}
				class="inline-flex min-h-6 shrink-0 items-center text-sm font-medium text-primary-dark underline underline-offset-2"
			>
				{copy.viewDeployment}<span class="sr-only">: {project.name}</span>
			</a>
		{:else if outcome.kind === 'needs_redeploy' && canManage}
			<Button
				variant="secondary"
				size="sm"
				onclick={startRedeploy}
				disabled={redeployMutation.isPending || !projectQuery.data}
				aria-label={`${copy.redeploy} ${project.name}`}
			>
				<DeployIcon size={16} aria-hidden="true" />
				{redeployMutation.isPending ? copy.redeploying : copy.redeploy}
			</Button>
		{/if}
	</div>
	{#if outcome.kind === 'needs_redeploy' && outcome.reason}
		<p class="text-sm text-muted">{outcome.reason}</p>
	{/if}
	{#if redeployError}
		<p role="alert" class="text-sm text-error-dark">{redeployError}</p>
	{/if}
</li>

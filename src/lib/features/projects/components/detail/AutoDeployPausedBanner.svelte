<script lang="ts">
	import { resolveRoute } from '$app/paths';
	import Pause from 'phosphor-svelte/lib/Pause';
	import { toast } from 'svelte-sonner';
	import { getErrorMessage } from '$lib/api/errors';
	import Button from '$lib/components/ui/Button.svelte';
	import { createDeploymentQuery } from '$lib/features/deployments/queries';
	import { formatDate, formatRelativeTime } from '$lib/utils/date';
	import { AUTO_DEPLOY_PAUSE_COPY, describeAutoDeployPause } from '../../auto-deploy-pause';
	import { createUpdateProjectMutation } from '../../mutations';
	import { createRecentDeploymentsQuery } from '../../queries';
	import type { AutoDeployPause, Project } from '../../type';

	type Props = {
		project: Pick<Project, 'id' | 'branch'>;
		pause: AutoDeployPause;
		/** Who may turn auto-deploy on again: owners and members, as for every project setting. */
		canResume: boolean;
		/** The team workspace whose owners and members a viewer can ask. */
		workspaceName?: string | null;
	};

	let { project, pause, canResume, workspaceName = null }: Props = $props();

	// The pause names the rollback deployment; the version it went back to is on that deployment.
	const recentQuery = createRecentDeploymentsQuery(() => project.id);
	const listed = $derived(
		recentQuery.data?.data.find((deployment) => deployment.id === pause.deployment_id)
	);
	const rollbackQuery = createDeploymentQuery(
		() => project.id,
		() => (pause.deployment_id && recentQuery.isSuccess && !listed ? pause.deployment_id : '')
	);
	const targetSequence = $derived(
		(listed ?? rollbackQuery.data?.data)?.rollback?.target_sequence ?? null
	);
	const notice = $derived(
		describeAutoDeployPause(pause, { branch: project.branch, targetSequence })
	);
	const rollbackHref = $derived(
		pause.deployment_id
			? resolveRoute('/(app)/projects/[id]/deployments/[deploymentId]', {
					id: project.id,
					deploymentId: pause.deployment_id
				})
			: null
	);

	const update = createUpdateProjectMutation();
	let errorMessage = $state('');

	function resume() {
		if (update.isPending) return;
		errorMessage = '';
		const branch = project.branch;
		update.mutate(
			{ id: project.id, data: { auto_deploy: true } },
			{
				onSuccess: () => {
					toast.success(AUTO_DEPLOY_PAUSE_COPY.resumed(branch));
				},
				onError: (error) => {
					errorMessage = getErrorMessage(error, AUTO_DEPLOY_PAUSE_COPY.resumeFailed);
				}
			}
		);
	}
</script>

<!--
	In the page's reading path, in its own words, because a paused auto-deploy is easy to forget and
	every push until then stays undeployed. One action, beside the header's Redeploy, never above it.
-->
<section
	aria-labelledby="auto-deploy-pause-title"
	class="flex flex-col gap-3 rounded-control border border-warning/30 bg-warning/10 px-4 py-3 md:flex-row md:items-center md:justify-between"
	data-testid="auto-deploy-paused-banner"
>
	<div class="flex min-w-0 items-start gap-2">
		<Pause size={20} weight="bold" class="mt-0.5 shrink-0 text-warning-dark" aria-hidden="true" />
		<div class="min-w-0 space-y-1 text-sm text-foreground">
			<h2 id="auto-deploy-pause-title" class="font-sans text-sm font-semibold text-foreground">
				{notice.title}
				<time
					class="font-normal text-foreground"
					datetime={pause.paused_at}
					title={formatDate(pause.paused_at)}>({formatRelativeTime(pause.paused_at)})</time
				>
			</h2>
			<p>
				{notice.consequence}
				{#if notice.held}
					<span data-testid="auto-deploy-held-count">{notice.held}</span>
				{/if}
			</p>
			<!-- Muted grey falls under 4.5:1 on the warning tint, so every line keeps the text colour. -->
			{#if canResume}
				<p>{notice.resumeHint}</p>
			{:else if workspaceName}
				<p>{AUTO_DEPLOY_PAUSE_COPY.askOwner(workspaceName)}</p>
			{/if}
			{#if rollbackHref && pause.deployment_sequence != null}
				<a
					href={rollbackHref}
					class="inline-flex min-h-6 items-center font-medium text-primary-dark underline underline-offset-2"
					>{AUTO_DEPLOY_PAUSE_COPY.rollbackLink(pause.deployment_sequence)}</a
				>
			{/if}
			{#if errorMessage}
				<p role="alert" class="text-error-dark">{errorMessage}</p>
			{/if}
		</div>
	</div>

	{#if canResume}
		<Button
			variant="secondary"
			size="sm"
			class="shrink-0 whitespace-nowrap max-md:w-full"
			onclick={resume}
			disabled={update.isPending}
			aria-busy={update.isPending}
		>
			{update.isPending ? AUTO_DEPLOY_PAUSE_COPY.resuming : AUTO_DEPLOY_PAUSE_COPY.resume}
		</Button>
	{/if}
</section>

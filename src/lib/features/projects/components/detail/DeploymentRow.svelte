<script lang="ts">
	import { resolveRoute } from '$app/paths';
	import StatusIndicator from '$lib/components/ui/StatusIndicator.svelte';
	import { deriveDurationLabel } from '$lib/features/deployments/deployment-presentation';
	import { formatDate, formatRelativeTime } from '$lib/utils/date';
	import type { Deployment } from '../../type';
	import {
		getDeploymentBadge,
		getDeploymentCardNote,
		getDeploymentIndicatorStatus
	} from '../../presentation';

	let { deployment }: { deployment: Deployment } = $props();

	const badge = $derived(getDeploymentBadge(deployment.status));
	const note = $derived(getDeploymentCardNote(deployment));
	const message = $derived(deployment.commit_message || 'Deployment manual');
	const duration = $derived(
		deriveDurationLabel(deployment.started_at, deployment.finished_at ?? deployment.cancelled_at)
	);
	const href = $derived(
		resolveRoute('/(app)/projects/[id]/deployments/[deploymentId]', {
			id: deployment.project_id,
			deploymentId: deployment.id
		})
	);
</script>

<!--
	One link, stretched over the row, so the whole row opens the deployment and a screen reader hears
	one thing per row. Below 48rem the row has two levels: what changed, then the facts.
-->
<li
	class="relative grid grid-cols-[auto_minmax(0,1fr)] gap-x-2.5 gap-y-1 px-4 py-3 transition-colors hover:bg-surface-tint @3xl:grid-cols-[6.5rem_2.5rem_minmax(0,1fr)_4.5rem_5rem_6.5rem_6.5rem] @3xl:items-center @3xl:gap-x-3 @3xl:py-2.5"
>
	<span
		class="inline-flex items-center gap-2 @3xl:col-start-1 @3xl:row-start-1"
		data-testid="deployment-row-status"
	>
		<StatusIndicator
			status={getDeploymentIndicatorStatus(deployment.status)}
			size="sm"
			showLabel={false}
			label=""
			colorClassOverride={deployment.status === 'queued' ? 'bg-queued text-white' : undefined}
			animateIcon={false}
		/>
		<span class="hidden text-sm text-foreground @3xl:inline">{badge.label}</span>
	</span>

	<div class="min-w-0 @3xl:col-start-3 @3xl:row-start-1">
		<a
			{href}
			aria-label={`Deployment #${deployment.sequence}, ${badge.label}: ${message}`}
			class="block min-h-6 truncate text-sm leading-6 font-medium text-foreground after:absolute after:inset-0 after:rounded-control after:content-[''] focus-visible:outline-none focus-visible:after:outline-3 focus-visible:after:outline-primary focus-visible:after:-outline-offset-3"
			title={message}
		>
			{message}
		</a>
		{#if note}
			<p class="truncate text-xs text-muted">{note}</p>
		{/if}
	</div>

	<div
		class="col-start-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted @3xl:contents"
	>
		<span class="font-medium text-foreground @3xl:hidden">{badge.label}</span>
		<span class="font-mono text-foreground tabular-nums @3xl:col-start-2 @3xl:row-start-1">
			#{deployment.sequence}
		</span>
		<span class="font-mono tabular-nums @3xl:col-start-4 @3xl:row-start-1">
			{deployment.commit_sha ? deployment.commit_sha.substring(0, 7) : '-'}
		</span>
		<span
			class="min-w-0 truncate font-mono @3xl:col-start-5 @3xl:row-start-1"
			title={deployment.branch}
		>
			{deployment.branch}
		</span>
		{#if deployment.created_at}
			<time
				datetime={deployment.created_at}
				title={formatDate(deployment.created_at)}
				class="whitespace-nowrap @3xl:col-start-6 @3xl:row-start-1"
			>
				{formatRelativeTime(deployment.created_at)}
			</time>
		{:else}
			<span class="@3xl:col-start-6 @3xl:row-start-1">-</span>
		{/if}
		<span class="tabular-nums @3xl:col-start-7 @3xl:row-start-1 @3xl:text-right"
			>{duration ?? '-'}</span
		>
	</div>
</li>

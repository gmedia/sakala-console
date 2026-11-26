<script lang="ts">
	import { resolveRoute } from '$app/paths';
	import { DropdownMenu } from 'bits-ui';
	import ArrowCounterClockwise from 'phosphor-svelte/lib/ArrowCounterClockwise';
	import DotsThree from 'phosphor-svelte/lib/DotsThree';
	import Badge from '$lib/components/ui/Badge.svelte';
	import StatusIndicator from '$lib/components/ui/StatusIndicator.svelte';
	import { buttonClasses } from '$lib/components/ui/button-classes';
	import { deriveDurationLabel } from '$lib/features/deployments/deployment-presentation';
	import { HISTORY_COPY } from '$lib/features/deployments/history-presentation';
	import { getReuseRowLabel } from '$lib/features/deployments/image-reuse-presentation';
	import { ROLLBACK_COPY } from '$lib/features/deployments/rollback';
	import { cn } from '$lib/utils/cn';
	import { formatDate, formatRelativeTime } from '$lib/utils/date';
	import type { Deployment } from '../../type';
	import { HISTORY_ACTION_CELL, historyRowColumns } from '../../history-grid';
	import {
		getDeploymentBadge,
		getDeploymentCardNote,
		getDeploymentIndicatorStatus
	} from '../../presentation';

	type Props = {
		deployment: Deployment;
		/** The version visitors get now. At most one row says so. */
		serving?: boolean;
		/** Who or what started it, when the row should say ("Rani, push ke main", "Rollback ke #4"). */
		triggerNote?: string | null;
		/** The page has a menu column, so this row keeps it even without a menu of its own. */
		withActions?: boolean;
		/** Set when this deployment can be rolled back to, by someone who may deploy. */
		onRollback?: () => void;
	};

	let {
		deployment,
		serving = false,
		triggerNote = null,
		withActions = false,
		onRollback
	}: Props = $props();

	const badge = $derived(getDeploymentBadge(deployment.status));
	const note = $derived(getDeploymentCardNote(deployment));
	const reuse = $derived(getReuseRowLabel(deployment.build));
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
	const accessibleName = $derived(
		[
			`Deployment #${deployment.sequence}, ${badge.label}`,
			serving && HISTORY_COPY.servingAccessible,
			triggerNote,
			reuse?.accessible
		]
			.filter(Boolean)
			.join(', ') + `: ${message}`
	);
</script>

<!--
	One link, stretched over the row, so the whole row opens the deployment and a screen reader hears
	one thing per row. Below 48rem the row has two levels: what changed, then the facts. The menu sits
	above the link, last, so the link comes first by keyboard.
-->
<li
	class={cn(
		'relative grid gap-x-2.5 gap-y-1 px-4 py-2.5 transition-colors hover:bg-surface-tint @3xl:items-center @3xl:gap-x-3',
		historyRowColumns(withActions)
	)}
	data-testid="deployment-row"
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
			aria-label={accessibleName}
			class="block min-h-6 truncate text-sm leading-6 font-medium text-foreground after:absolute after:inset-0 after:rounded-control after:content-[''] focus-visible:outline-none focus-visible:after:outline-3 focus-visible:after:-outline-offset-3 focus-visible:after:outline-primary"
			title={message}
		>
			{message}
		</a>
		{#if serving || triggerNote || note || reuse}
			<p class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
				{#if serving}
					<span data-testid="deployment-row-serving"
						><Badge tone="success">{HISTORY_COPY.serving}</Badge></span
					>
				{/if}
				{#if triggerNote}
					<span class="min-w-0 truncate" title={triggerNote} data-testid="deployment-row-trigger"
						>{triggerNote}</span
					>
				{/if}
				{#if reuse}
					<span class="whitespace-nowrap" data-testid="deployment-row-reuse">{reuse.label}</span>
				{/if}
				{#if note}
					<span class="min-w-0 truncate">{note}</span>
				{/if}
			</p>
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

	{#if withActions}
		<div class={cn('flex justify-end', HISTORY_ACTION_CELL)}>
			{#if onRollback}
				<DropdownMenu.Root>
					<DropdownMenu.Trigger
						aria-label={ROLLBACK_COPY.rowMenuLabel(deployment.sequence)}
						title={ROLLBACK_COPY.rowMenuLabel(deployment.sequence)}
						data-testid="deployment-row-menu"
						class={buttonClasses('ghost', 'icon-sm', 'relative z-10')}
					>
						<DotsThree size={20} weight="bold" aria-hidden="true" />
					</DropdownMenu.Trigger>
					<DropdownMenu.Portal>
						<DropdownMenu.Content
							sideOffset={4}
							align="end"
							collisionPadding={8}
							class="z-50 w-64 max-w-[calc(100vw-1rem)] rounded-overlay border border-border bg-surface p-1 shadow-overlay"
						>
							<DropdownMenu.Item
								class="flex cursor-pointer items-center gap-3 rounded-control px-3 py-2.5 text-left text-sm font-semibold text-foreground outline-none data-highlighted:bg-background-soft"
								onSelect={onRollback}
							>
								<ArrowCounterClockwise
									size={16}
									weight="bold"
									class="shrink-0"
									aria-hidden="true"
								/>
								{ROLLBACK_COPY.action}
							</DropdownMenu.Item>
						</DropdownMenu.Content>
					</DropdownMenu.Portal>
				</DropdownMenu.Root>
			{/if}
		</div>
	{/if}
</li>

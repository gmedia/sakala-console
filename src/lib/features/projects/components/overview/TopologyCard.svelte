<script lang="ts">
	// Links here are resolveRoute() output from overview/links.ts, some with an anchor added, which
	// the rule cannot follow.
	/* eslint-disable svelte/no-navigation-without-resolve */
	import Badge from '$lib/components/ui/Badge.svelte';
	import BreakableUrl from '$lib/components/ui/BreakableUrl.svelte';
	import { cn } from '$lib/utils/cn';
	import { topologyHref } from '../../overview/links';
	import {
		TOPOLOGY_COPY,
		type AttachedItem,
		type Topology,
		type TopologyNode,
		type TopologyTone
	} from '../../overview/topology';

	type Props = { projectId: string; topology: Topology };

	let { projectId, topology }: Props = $props();

	const TONE_CLASSES: Record<TopologyTone, string> = {
		live: 'border-primary',
		neutral: 'border-border',
		running: 'border-dashed border-primary',
		warning: 'border-warning',
		error: 'border-error'
	};

	const BOX_CLASS = 'flex min-w-0 flex-col gap-1 rounded-control border bg-surface p-3 text-left';
	const LINK_CLASS = 'transition-colors hover:bg-surface-tint';
</script>

{#snippet nodeContent(node: TopologyNode)}
	<span class="text-xs font-medium text-muted">{node.label}</span>
	{#if node.value}
		<span class={cn('text-sm font-medium wrap-anywhere text-foreground', node.mono && 'font-mono')}>
			{#if node.mono}<BreakableUrl text={node.value} />{:else}{node.value}{/if}
		</span>
	{/if}
	{#if node.badge || node.facts.length > 0}
		<span class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-foreground">
			{#if node.badge}
				<Badge tone={node.badge.tone}>{node.badge.label}</Badge>
			{/if}
			{#each node.facts as fact (fact)}
				<span class="tabular-nums" data-testid={`topology-fact-${node.id}`}>{fact}</span>
			{/each}
		</span>
	{/if}
	{#if node.detail}
		<span class="text-xs text-muted">{node.detail}</span>
	{/if}
	{#if node.target}
		<span class="mt-auto pt-1 text-xs font-medium text-primary-dark">
			{TOPOLOGY_COPY.links[node.target]}
		</span>
	{/if}
{/snippet}

{#snippet attachedBox(item: AttachedItem)}
	<a
		href={topologyHref(item.target, projectId)}
		class={cn(BOX_CLASS, LINK_CLASS, 'h-full border-border')}
		data-testid={`topology-attached-${item.id}`}
	>
		<span class="text-xs font-medium text-muted">{item.label}</span>
		<span
			class={cn(
				'text-sm wrap-anywhere',
				item.empty ? 'text-muted' : 'font-medium text-foreground',
				item.mono && 'line-clamp-2 font-mono'
			)}
			title={item.mono ? item.value : undefined}>{item.value}</span
		>
		<span class="mt-auto pt-1 text-xs font-medium text-primary-dark">
			{TOPOLOGY_COPY.links[item.target]}
		</span>
	</a>
{/snippet}

<section
	aria-labelledby="overview-topology-title"
	class="surface-card flex min-w-0 flex-col gap-4 p-4 sm:p-6"
	data-testid="overview-topology"
>
	<div class="flex flex-col gap-1">
		<h2 id="overview-topology-title" class="text-base text-foreground">{TOPOLOGY_COPY.title}</h2>
		<p class="max-w-reading text-sm text-foreground" data-testid="topology-summary">
			{topology.summary}
		</p>
	</div>

	<div class="topology @container">
		<div class="topology-layout">
			<ol class="topology-path" aria-label={TOPOLOGY_COPY.pathLabel}>
				{#each topology.path as node, index (node.id)}
					<li class="topology-step" data-testid={`topology-node-${node.id}`}>
						{#if node.target}
							<a
								href={topologyHref(node.target, projectId)}
								class={cn(BOX_CLASS, LINK_CLASS, 'topology-box', TONE_CLASSES[node.tone])}
							>
								{@render nodeContent(node)}
							</a>
						{:else}
							<div class={cn(BOX_CLASS, 'topology-box', TONE_CLASSES[node.tone])}>
								{@render nodeContent(node)}
							</div>
						{/if}
						{#if index < topology.path.length - 1}
							<span class="connector" aria-hidden="true"></span>
						{/if}
					</li>
				{/each}
			</ol>

			<span class="connector connector-attached" aria-hidden="true"></span>

			<section
				aria-labelledby="overview-attached-title"
				class="attached flex flex-col gap-2 rounded-card bg-surface-tint p-3"
				data-testid="topology-attached"
			>
				<h3 id="overview-attached-title" class="text-xs font-medium text-foreground">
					{TOPOLOGY_COPY.attachedTitle}
				</h3>
				<ul class="@3xl:max-@5xl:grid-cols-2 grid gap-2">
					{#each topology.attached as item (item.id)}
						<li class="min-w-0">{@render attachedBox(item)}</li>
					{/each}
				</ul>
			</section>
		</div>
	</div>
</section>

<style>
	/*
	 * The path reads top to bottom on a narrow card and left to right from 48rem, the attached group
	 * beside it from 64rem. Connectors are lines with an arrowhead, hidden from assistive technology:
	 * the ordered list and the summary already say what follows what.
	 */
	.topology-layout {
		display: flex;
		flex-direction: column;
	}

	.topology-path {
		display: flex;
		flex-direction: column;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.topology-step {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.connector {
		position: relative;
		flex: none;
		align-self: center;
		width: 2px;
		height: 1.75rem;
		background: var(--color-primary);
	}

	.connector::after {
		content: '';
		position: absolute;
		bottom: 0;
		left: 50%;
		transform: translateX(-50%);
		border-style: solid;
		border-width: 6px 5px 0;
		border-color: var(--color-primary) transparent transparent;
	}

	/* Wired to the app, not a hop visitors take: dashed, without an arrowhead. */
	.connector-attached {
		width: 0;
		background: none;
		border-left: 2px dashed var(--color-primary-400);
	}

	.connector-attached::after {
		display: none;
	}

	@container (min-width: 48rem) {
		.topology-path {
			flex-direction: row;
		}

		/* Steps with a connector start at its width, so every box gets the same share. */
		.topology-step {
			flex: 1 1 1.75rem;
			flex-direction: row;
			align-items: center;
		}

		.topology-step:last-child {
			flex-basis: 0;
		}

		.topology-box {
			flex: 1 1 0;
			align-self: stretch;
		}

		.connector {
			width: 1.75rem;
			height: 2px;
		}

		.connector::after {
			top: 50%;
			right: 0;
			bottom: auto;
			left: auto;
			transform: translateY(-50%);
			border-width: 5px 0 5px 6px;
			border-color: transparent transparent transparent var(--color-primary);
		}

		.connector-attached {
			display: none;
		}

		.attached {
			margin-top: 1rem;
		}
	}

	@container (min-width: 64rem) {
		.topology-layout {
			flex-direction: row;
			align-items: center;
		}

		.topology-path {
			flex: 1 1 auto;
			min-width: 0;
		}

		.connector-attached {
			display: block;
			width: 1.75rem;
			height: 0;
			border-top: 2px dashed var(--color-primary-400);
			border-left: none;
		}

		.attached {
			flex: none;
			width: 15rem;
			margin-top: 0;
		}
	}
</style>

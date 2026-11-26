<script lang="ts">
	import { TOPOLOGY_COPY, type Topology, type TopologyGroup } from '../../overview/topology';
	import TopologyBlock from './TopologyBlock.svelte';

	type Props = { projectId: string; topology: Topology };

	let { projectId, topology }: Props = $props();
</script>

{#snippet frame(group: TopologyGroup, ordered: boolean)}
	<div class="topology-frame" data-testid={`topology-group-${group.id}`}>
		<h3 id={`topology-group-${group.id}`} class="topology-frame-label">{group.label}</h3>
		{#if ordered}
			<ol class="topology-blocks" aria-labelledby={`topology-group-${group.id}`}>
				{#each group.blocks as block, index (block.id)}
					<li class="topology-block-step">
						<TopologyBlock {projectId} {block} />
						{#if index < group.blocks.length - 1}
							<span class="connector connector-block" aria-hidden="true"></span>
						{/if}
					</li>
				{/each}
			</ol>
		{:else}
			<ul
				class="topology-blocks topology-blocks-attached"
				aria-labelledby={`topology-group-${group.id}`}
			>
				{#each group.blocks as block (block.id)}
					<li class="topology-block-step">
						<TopologyBlock {projectId} {block} />
					</li>
				{/each}
			</ul>
		{/if}
	</div>
{/snippet}

<section
	aria-labelledby="overview-topology-title"
	aria-describedby="overview-topology-summary"
	class="surface-card flex min-w-0 flex-col gap-4 p-4 sm:p-6"
	data-testid="overview-topology"
>
	<div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
		<!-- The title says what the diagram is; a lead line under it only repeated it. -->
		<h2 id="overview-topology-title" class="min-w-0 text-base text-foreground">
			{TOPOLOGY_COPY.title}
		</h2>
		<p class="text-xs text-muted">{TOPOLOGY_COPY.hint}</p>
	</div>
	<!-- The whole diagram in words, for screen readers; sighted readers get the canvas. -->
	<p id="overview-topology-summary" class="sr-only" data-testid="topology-summary">
		{topology.summary}
	</p>

	<div class="topology-canvas @container">
		<div class="topology-layout">
			<ol class="topology-path" aria-label={TOPOLOGY_COPY.pathLabel}>
				{#each topology.path as group, index (group.id)}
					<li class="topology-group-step">
						{@render frame(group, true)}
						{#if index < topology.path.length - 1}
							<span class="connector connector-group" aria-hidden="true"></span>
						{/if}
					</li>
				{/each}
			</ol>

			<span class="connector connector-attached" aria-hidden="true"></span>
			{@render frame(topology.attached, false)}
		</div>
	</div>
</section>

<style>
	/*
	 * A canvas, not a list of cards: frames on a dot grid, blocks inside them, and lines between.
	 * Everything stacks top to bottom on a narrow card; blocks inside a frame sit side by side from
	 * 34rem, and the frames themselves from 58rem. Connectors are drawing only, hidden from
	 * assistive technology: the ordered lists and the description carry the order.
	 */
	.topology-canvas {
		border-radius: var(--radius-card);
		background-color: var(--color-background);
		/* Decoration at low contrast: the skeleton grey is seen without competing with the blocks. */
		background-image: radial-gradient(circle, var(--color-skeleton) 1px, transparent 1.25px);
		background-size: 16px 16px;
		padding: 1.5rem 1rem 1rem;
	}

	.topology-layout,
	.topology-path,
	.topology-group-step,
	.topology-blocks,
	.topology-block-step {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.topology-path,
	.topology-blocks {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.topology-frame {
		position: relative;
		min-width: 0;
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-card);
		padding: 1.25rem 0.75rem 0.75rem;
	}

	/* The label sits on the frame's edge, on the canvas colour, so the dots stop behind it. */
	.topology-frame-label {
		position: absolute;
		top: 0;
		left: 0.75rem;
		transform: translateY(-50%);
		margin: 0;
		padding: 0 0.375rem;
		background: var(--color-background);
		font-family: var(--font-sans);
		font-size: var(--text-xs);
		line-height: var(--text-xs--line-height);
		font-weight: var(--font-weight-medium);
		color: var(--color-foreground);
	}

	.topology-blocks-attached {
		gap: 0.5rem;
	}

	.connector {
		position: relative;
		flex: none;
		align-self: center;
		width: 2px;
		height: 1.5rem;
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

	.connector-group {
		height: 2rem;
	}

	/* Wired to the app, not a hop a visitor takes: dashed, without an arrowhead. */
	.connector-attached {
		width: 0;
		height: 2rem;
		background: none;
		border-left: 2px dashed var(--color-primary-400);
	}

	.connector-attached::after {
		display: none;
	}

	@container (min-width: 34rem) {
		.topology-blocks {
			flex-direction: row;
		}

		/* Steps with a connector start at its width, so every block gets the same share. */
		.topology-block-step {
			flex: 1 1 1.5rem;
			flex-direction: row;
			align-items: center;
		}

		.topology-block-step:last-child {
			flex-basis: 0;
		}

		.topology-block-step > :global(button) {
			flex: 1 1 0;
			align-self: stretch;
		}

		.connector-block {
			width: 1.5rem;
			height: 2px;
		}

		.connector-block::after {
			top: 50%;
			right: 0;
			bottom: auto;
			left: auto;
			transform: translateY(-50%);
			border-width: 5px 0 5px 6px;
			border-color: transparent transparent transparent var(--color-primary);
		}
	}

	@container (min-width: 58rem) {
		.topology-layout,
		.topology-path {
			flex-direction: row;
			align-items: center;
		}

		.topology-path {
			flex: 1 1 auto;
		}

		.topology-group-step {
			flex: 1 1 2rem;
			flex-direction: row;
			align-items: stretch;
		}

		.topology-group-step:last-child {
			flex-basis: 0;
		}

		.topology-group-step > .topology-frame {
			flex: 1 1 0;
		}

		.connector-group {
			width: 2rem;
			height: 2px;
			align-self: center;
		}

		.connector-group::after {
			top: 50%;
			right: 0;
			bottom: auto;
			left: auto;
			transform: translateY(-50%);
			border-width: 5px 0 5px 6px;
			border-color: transparent transparent transparent var(--color-primary);
		}

		.connector-attached {
			width: 2rem;
			height: 0;
			border-top: 2px dashed var(--color-primary-400);
			border-left: none;
		}

		.topology-layout > .topology-frame {
			flex: none;
			width: 13rem;
		}

		.topology-blocks-attached {
			flex-direction: column;
		}
	}
</style>

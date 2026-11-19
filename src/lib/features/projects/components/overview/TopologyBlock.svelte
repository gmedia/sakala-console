<script lang="ts">
	// The details link is resolveRoute() output from overview/links.ts, some with an anchor added,
	// which the rule cannot follow.
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { Popover } from 'bits-ui';
	import Cube from 'phosphor-svelte/lib/Cube';
	import Database from 'phosphor-svelte/lib/Database';
	import Globe from 'phosphor-svelte/lib/Globe';
	import HardDrives from 'phosphor-svelte/lib/HardDrives';
	import Key from 'phosphor-svelte/lib/Key';
	import Moon from 'phosphor-svelte/lib/Moon';
	import ShareNetwork from 'phosphor-svelte/lib/ShareNetwork';
	import TerminalWindow from 'phosphor-svelte/lib/TerminalWindow';
	import X from 'phosphor-svelte/lib/X';
	import Badge from '$lib/components/ui/Badge.svelte';
	import BreakableUrl from '$lib/components/ui/BreakableUrl.svelte';
	import { cn } from '$lib/utils/cn';
	import { topologyHref } from '../../overview/links';
	import type {
		ReplicaCell,
		TopologyBlock,
		TopologyBlockId,
		TopologyTone
	} from '../../overview/topology';

	type Props = { projectId: string; block: TopologyBlock };

	let { projectId, block }: Props = $props();

	let open = $state(false);

	const ICONS: Record<TopologyBlockId, typeof Globe> = {
		address: Globe,
		edge: ShareNetwork,
		node: HardDrives,
		app: Cube,
		database: Database,
		variables: Key,
		release_command: TerminalWindow
	};

	const TONES: Record<TopologyTone, string> = {
		live: 'border-primary bg-surface',
		neutral: 'border-border bg-surface',
		running: 'border-dashed border-primary bg-surface',
		warning: 'border-warning bg-surface',
		error: 'border-error bg-surface',
		// Ghosted, not faded: the dashed edge on the canvas colour says "not running" while the text
		// keeps its contrast.
		asleep: 'border-dashed border-border-strong bg-background'
	};

	/** Ready is filled teal, not ready is red with a cross, unknown and idle are outlines. */
	const CELLS: Record<ReplicaCell, string> = {
		ready: 'bg-primary',
		unready: 'bg-error text-white',
		unknown: 'border border-border-strong bg-surface',
		idle: 'border border-dashed border-border-strong'
	};

	const Icon = $derived(ICONS[block.id]);
	const contentId = $derived(`topology-detail-${block.id}`);
</script>

<Popover.Root bind:open>
	<Popover.Trigger
		class={cn(
			'flex w-full min-w-0 cursor-pointer flex-col gap-1.5 rounded-control border p-3 text-left transition-colors hover:border-primary',
			TONES[block.tone]
		)}
		aria-controls={contentId}
		data-testid={`topology-block-${block.id}`}
	>
		<span class="flex items-center gap-2 text-xs font-medium text-muted">
			<Icon size={16} class="shrink-0 text-primary-dark" aria-hidden="true" />
			<span class="min-w-0 truncate">{block.name}</span>
			{#if block.tone === 'asleep' && block.id === 'app'}
				<Moon size={16} class="ml-auto shrink-0 text-foreground" aria-hidden="true" />
			{/if}
		</span>
		<span class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
			{#if block.badge}
				<Badge tone={block.badge.tone}>{block.badge.label}</Badge>
			{/if}
			<span
				class={cn(
					'min-w-0 text-sm font-medium wrap-anywhere text-foreground',
					block.mono && 'font-mono'
				)}
			>
				{#if block.mono}<BreakableUrl text={block.fact} />{:else}{block.fact}{/if}
			</span>
		</span>
		{#if block.replicas}
			<span
				class="flex flex-wrap items-center gap-1"
				role="img"
				aria-label={block.replicas.accessibleLabel}
				data-testid="topology-replicas"
			>
				{#each block.replicas.cells as cell, index (index)}
					<span
						class={cn('inline-flex size-4 items-center justify-center rounded-full', CELLS[cell])}
						data-cell={cell}
						aria-hidden="true"
					>
						{#if cell === 'unready'}<X size={10} weight="bold" />{/if}
					</span>
				{/each}
				<span class="ml-1 text-xs font-medium text-foreground tabular-nums" aria-hidden="true"
					>{block.replicas.label}</span
				>
			</span>
		{/if}
	</Popover.Trigger>

	<Popover.Portal>
		<Popover.Content
			id={contentId}
			side="bottom"
			align="start"
			sideOffset={8}
			collisionPadding={16}
			role="dialog"
			aria-label={block.name}
			class="z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 rounded-overlay border border-border bg-surface p-4 shadow-overlay focus:outline-none"
			data-testid={`topology-detail-${block.id}`}
		>
			<p class="flex items-center gap-2 text-sm font-semibold text-foreground">
				<Icon size={16} class="shrink-0 text-primary-dark" aria-hidden="true" />
				{block.name}
			</p>
			{#if block.detail.value}
				<p
					class="rounded-control bg-background-soft px-2 py-1 font-mono text-xs wrap-anywhere text-foreground"
				>
					{block.detail.value}
				</p>
			{/if}
			{#if block.replicas}
				<p class="text-sm text-foreground">{block.replicas.accessibleLabel}.</p>
			{/if}
			{#each block.detail.body as line (line)}
				<p class="text-sm text-muted">{line}</p>
			{/each}
			{#if block.detail.link}
				<a
					href={topologyHref(block.detail.link, projectId)}
					onclick={() => (open = false)}
					class="inline-flex min-h-6 items-center self-start text-sm font-medium text-primary-dark underline underline-offset-2"
				>
					{block.detail.link.label}
				</a>
			{/if}
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>

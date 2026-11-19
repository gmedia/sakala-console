<script lang="ts">
	import TreeStructureIcon from 'phosphor-svelte/lib/TreeStructureIcon';
	import { cn } from '$lib/utils/cn';
	import { monorepoHeadline, monorepoRows } from '../../monorepo-presentation';
	import type { ProjectMonorepo } from '../../type';

	type Props = {
		monorepo: ProjectMonorepo;
		/** Under a timeline step: smaller type and no box, the commands only. */
		compact?: boolean;
		/** One line under the commands, such as where they came from. */
		note?: string;
	};

	let { monorepo, compact = false, note }: Props = $props();

	const rows = $derived(
		compact
			? monorepoRows(monorepo).filter((row) => row.label.endsWith('command'))
			: monorepoRows(monorepo)
	);
</script>

<div
	class={cn('min-w-0', compact ? 'mt-1' : 'rounded-control border border-border bg-surface p-3')}
	data-testid="monorepo-summary"
>
	<p
		class={cn(
			'flex items-start gap-2 text-foreground',
			compact ? 'text-xs' : 'text-sm font-semibold'
		)}
	>
		{#if !compact}
			<TreeStructureIcon class="mt-0.5 size-5 shrink-0 text-primary-dark" aria-hidden="true" />
		{/if}
		<span class="min-w-0 wrap-anywhere">{monorepoHeadline(monorepo)}</span>
	</p>
	<dl
		class={cn(
			'grid gap-x-3 gap-y-1',
			compact ? 'mt-1 text-xs' : 'mt-2 text-sm sm:grid-cols-[9rem_minmax(0,1fr)]'
		)}
	>
		{#each rows as row (row.label)}
			<div class="contents">
				<dt class="text-muted">{row.label}</dt>
				<dd
					class={cn(
						'min-w-0 wrap-anywhere',
						row.code ? 'font-mono text-foreground' : 'text-foreground/80',
						!compact && 'max-sm:mb-1'
					)}
				>
					{row.value}
				</dd>
			</div>
		{/each}
	</dl>
	{#if note}
		<p class={cn('text-muted', compact ? 'mt-1 text-xs' : 'mt-2 text-xs')}>{note}</p>
	{/if}
</div>

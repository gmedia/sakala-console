<script lang="ts">
	import type { Component } from 'svelte';
	import ArrowUpRight from 'phosphor-svelte/lib/ArrowUpRight';
	import ArrowDownRight from 'phosphor-svelte/lib/ArrowDownRight';
	import Minus from 'phosphor-svelte/lib/Minus';
	import { cn } from '$lib/utils/cn';
	import type { Trend } from '../format';

	type Props = {
		label: string;
		value: string;
		/** What the number counts, in one sentence. */
		help: string;
		trend?: Trend | null;
		icon?: Component<{ size?: number; 'aria-hidden'?: 'true' }>;
		tone?: 'primary' | 'error';
		loading?: boolean;
	};

	let {
		label,
		value,
		help,
		trend = null,
		icon: Icon,
		tone = 'primary',
		loading = false
	}: Props = $props();

	const trendClass = $derived(
		trend?.good === true ? 'text-success' : trend?.good === false ? 'text-error' : 'text-muted'
	);
	const trendWords = $derived(
		trend === null
			? ''
			: trend.direction === 'flat'
				? 'sama dengan periode sebelumnya'
				: `${trend.direction === 'up' ? 'naik' : 'turun'} ${trend.text} dibanding periode sebelumnya`
	);
</script>

<article class="surface-card flex flex-col gap-3 p-5">
	<div class="flex items-start justify-between gap-3">
		{#if Icon}
			<span
				class={cn(
					'flex size-9 items-center justify-center rounded-control',
					tone === 'error' ? 'bg-error/10 text-error' : 'bg-primary-50 text-primary'
				)}
			>
				<Icon size={20} aria-hidden="true" />
			</span>
		{/if}
		{#if trend && !loading}
			<span class={cn('inline-flex items-center gap-1 text-xs font-medium', trendClass)}>
				{#if trend.direction === 'up'}
					<ArrowUpRight size={14} aria-hidden="true" />
				{:else if trend.direction === 'down'}
					<ArrowDownRight size={14} aria-hidden="true" />
				{:else}
					<Minus size={14} aria-hidden="true" />
				{/if}
				<span aria-hidden="true">{trend.text}</span>
				<span class="sr-only">{trendWords}</span>
			</span>
		{/if}
	</div>
	<div>
		{#if loading}
			<span class="skeleton block h-8 w-16"></span>
		{:else}
			<p class="font-display text-3xl font-semibold text-foreground">{value}</p>
		{/if}
		<p class="mt-1 text-sm font-medium text-foreground">{label}</p>
		<p class="mt-1 text-xs text-muted">{help}</p>
	</div>
</article>

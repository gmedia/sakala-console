<script lang="ts">
	import type { Component } from 'svelte';
	import { resolve } from '$app/paths';
	import type { Pathname, ResolvedPathname } from '$app/types';

	export type BreadCrumbItem = {
		label: string;
		href?: Pathname;
		current?: boolean;
	};

	type Props = {
		items: BreadCrumbItem[];
		separator?: Component;
		class?: string;
	};

	let { items, separator: Separator, class: className = '' }: Props = $props();

	// `resolve` takes one tuple type per route. Past about 25 routes TypeScript stops relating a
	// union of paths to that union of tuples, though every member is accepted on its own.
	const resolvePath = resolve as (path: Pathname) => ResolvedPathname;
</script>

<nav aria-label="Breadcrumb" class={className}>
	<ol class="flex flex-wrap items-center gap-2">
		{#each items as item, index (item.label)}
			<li class="flex items-center gap-2">
				{#if item.current}
					<span aria-current="page" class="hover:text-foreground">
						{item.label}
					</span>
				{:else if item.href}
					<a href={resolvePath(item.href)} class="inline-flex min-h-6 items-center text-muted">
						{item.label}
					</a>
				{:else}
					<span class="text-muted">
						{item.label}
					</span>
				{/if}

				{#if index < items.length - 1}
					{#if Separator}
						<Separator />
					{:else}
						<span aria-hidden="true">/</span>
					{/if}
				{/if}
			</li>
		{/each}
	</ol>
</nav>

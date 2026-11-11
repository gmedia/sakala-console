<script lang="ts">
	// Links here are resolve() output, some with a query string added, which the rule cannot follow.
	/* eslint-disable svelte/no-navigation-without-resolve */
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import { pageTitle } from '$lib/utils/page-title';

	type Crumb = { label: string; href?: string };

	type Props = {
		title: string;
		description?: string;
		/** Above the title, after "Admin". The last one is the page itself and is not a link. */
		crumbs?: Crumb[];
		/** The tab title, when the heading alone does not identify the page. */
		documentTitle?: string;
		actions?: Snippet;
		/** Right of the breadcrumb: when the numbers were computed. */
		meta?: Snippet;
		children?: Snippet;
	};

	let { title, description, crumbs = [], documentTitle, actions, meta, children }: Props = $props();
</script>

<svelte:head><title>{pageTitle(documentTitle ?? title, 'Admin')}</title></svelte:head>

<header class="mb-6 flex flex-col gap-4">
	<div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
		<nav aria-label="Breadcrumb" class="min-w-0 text-sm">
			<ol class="flex flex-wrap items-center gap-x-2 gap-y-1">
				<li class="flex items-center gap-2">
					{#if crumbs.length}
						<a
							href={resolve('/admin')}
							class="inline-flex min-h-6 items-center text-muted hover:text-foreground">Admin</a
						>
						<span aria-hidden="true" class="text-muted">/</span>
					{:else}
						<span aria-current="page" class="text-foreground">Admin</span>
					{/if}
				</li>
				{#each crumbs as crumb, index (index)}
					<li class="flex min-w-0 items-center gap-2">
						{#if crumb.href && index < crumbs.length - 1}
							<a
								href={crumb.href}
								class="inline-flex min-h-6 items-center text-muted hover:text-foreground"
								>{crumb.label}</a
							>
							<span aria-hidden="true" class="text-muted">/</span>
						{:else}
							<span aria-current="page" class="min-w-0 wrap-anywhere text-foreground"
								>{crumb.label}</span
							>
						{/if}
					</li>
				{/each}
			</ol>
		</nav>
		{#if meta}
			<div class="text-sm text-muted">{@render meta()}</div>
		{/if}
	</div>

	<div class="flex flex-wrap items-start justify-between gap-4">
		<div class="min-w-0 flex-1 basis-72">
			<h1 class="text-2xl wrap-anywhere text-foreground">{title}</h1>
			{#if description}
				<p class="mt-1 text-sm text-muted">{description}</p>
			{/if}
			{#if children}
				<div class="mt-2">{@render children()}</div>
			{/if}
		</div>
		{#if actions}
			<div class="flex flex-wrap items-center gap-2">{@render actions()}</div>
		{/if}
	</div>
</header>

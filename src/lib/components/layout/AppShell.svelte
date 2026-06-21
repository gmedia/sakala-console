<script lang="ts">
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { ExternalLink, GitFork, Menu } from '@lucide/svelte';
	import SakalaLogo from '$lib/components/brand/SakalaLogo.svelte';
	import { cn } from '$lib/utils/cn';

	type Props = {
		children: Snippet;
	};

	let { children }: Props = $props();

	const navigation = [
		{ href: '/dashboard', label: 'Overview' },
		{ href: '/projects', label: 'Projects' },
		{ href: '/settings', label: 'Settings' }
	] as const;

	function isActive(href: string): boolean {
		return page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
	}
</script>

<div class="min-h-screen bg-background">
	<header class="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-xl">
		<div class="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
			<SakalaLogo compact />

			<nav class="hidden items-center gap-1 md:flex" aria-label="Navigasi utama">
				{#each navigation as item (item.href)}
					<a
						href={resolve(item.href)}
						aria-current={isActive(item.href) ? 'page' : undefined}
						class={cn(
							'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
							isActive(item.href)
								? 'bg-primary-soft text-primary-dark'
								: 'text-muted hover:bg-background-soft hover:text-foreground'
						)}
					>
						{item.label}
					</a>
				{/each}
			</nav>

			<div class="ml-auto hidden items-center gap-2 sm:flex">
				<a
					href="https://sakala.dev/docs"
					target="_blank"
					rel="noreferrer"
					class="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-background-soft hover:text-foreground"
				>
					Docs <ExternalLink size={14} aria-hidden="true" />
				</a>
				<a
					href="https://github.com/gmedia/sakala-console"
					target="_blank"
					rel="noreferrer"
					class="inline-flex size-10 items-center justify-center rounded-lg border border-border bg-surface text-muted hover:border-border-strong hover:text-foreground"
					aria-label="Buka repository Sakala Console di GitHub"
				>
					<GitFork size={18} aria-hidden="true" />
				</a>
			</div>

			<details class="group relative ml-auto md:hidden">
				<summary
					class="flex size-10 cursor-pointer list-none items-center justify-center rounded-lg border border-border bg-surface text-muted marker:hidden"
					aria-label="Buka navigasi"
				>
					<Menu size={20} aria-hidden="true" />
				</summary>
				<nav
					class="absolute top-12 right-0 grid w-56 gap-1 rounded-xl border border-border bg-surface p-2 shadow-xl"
					aria-label="Navigasi mobile"
				>
					{#each navigation as item (item.href)}
						<a
							href={resolve(item.href)}
							class={cn(
								'rounded-lg px-3 py-2 text-sm font-medium',
								isActive(item.href) ? 'bg-primary-soft text-primary-dark' : 'text-muted'
							)}
						>
							{item.label}
						</a>
					{/each}
				</nav>
			</details>
		</div>
	</header>

	<main class="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
		{@render children()}
	</main>
</div>

<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import type { Snippet } from 'svelte';
	import { Bell, ExternalLink, Menu } from '@lucide/svelte';
	import { page } from '$app/state';
	import SakalaLogo from '$lib/components/brand/SakalaLogo.svelte';
	import { cn } from '$lib/utils/cn';
	import Button from '../ui/Button.svelte';
	import { base } from '$app/paths';

	type Props = {
		children: Snippet;
	};

	let { children }: Props = $props();

	const navigation = [
		{ href: '/dashboard', label: 'My Projects' },
		{ href: '/projects', label: 'User Guide' }
	] as const;

	function isActive(href: string): boolean {
		return page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
	}

	let isMobileOpen = $state(false);
</script>

<div class="flex h-screen overflow-hidden bg-background">
	<aside class="hidden w-64 flex-col border-r border-border bg-surface md:flex">
		<div class="flex h-16 items-center px-6 border-b border-border">
			<SakalaLogo />
		</div>
		<nav class="flex-1 space-y-1 px-4 py-6" aria-label="Navigasi utama">
			{#each navigation as item (item.href)}
				<a
					href={`${base}{item.href}`}
					aria-current={isActive(item.href) ? 'page' : undefined}
					class={cn(
						'flex items-center rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
						isActive(item.href)
							? 'bg-primary-soft text-primary-dark font-semibold'
							: 'text-muted hover:bg-background-soft hover:text-foreground'
					)}
				>
					{item.label}
				</a>
			{/each}

			<div class="grid gap-2 grid-cols-2 absolute bottom-0 px-4 py-6">
				<Button variant="secondary" class="hover:bg-primary-soft hover:text-black transition-colors"
					>Setting</Button
				>
				<Button variant="secondary" class="hover:bg-primary-soft hover:text-black transition-colors"
					>Profile</Button
				>
			</div>
		</nav>
	</aside>

	<div class="flex flex-1 flex-col overflow-hidden">
		<header
			class="sticky top-0 z-40 flex h-16 items-center border-b border-border bg-background/90 backdrop-blur-xl px-4 sm:px-6 lg:px-8"
		>
			<button
				type="button"
				class="inline-flex size-10 items-center justify-center rounded-lg text-muted hover:bg-background-soft hover:text-foreground md:hidden"
				onclick={() => (isMobileOpen = !isMobileOpen)}
				aria-label="Buka navigasi"
			>
				<Menu size={20} />
			</button>

			<div class="ml-auto flex items-center gap-4">
				<a
					href="https://sakala.dev/docs"
					target="_blank"
					rel="noreferrer"
					class="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-background-soft hover:text-foreground"
				>
					Docs <ExternalLink size={14} aria-hidden="true" />
				</a>
				<button
					type="button"
					class="relative inline-flex size-10 items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground hover:border-border-strong hover:text-foreground transition-colors"
					aria-label="Buka notifikasi"
				>
					<Bell size={20} />
					<span class="absolute top-2.5 right-2.5 flex h-2 w-2">
						<span
							class="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"
						></span>
						<span class="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
					</span>
				</button>
			</div>
		</header>
		<main class="flex-1 overflow-y-auto px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
			<div class="mx-auto w-full max-w-7xl">
				{@render children()}
			</div>
		</main>
	</div>
</div>

{#if isMobileOpen}
	<button
		type="button"
		class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm md:hidden w-full h-full cursor-default"
		onclick={() => (isMobileOpen = false)}
		aria-label="Tutup menu"
	></button>

	<nav
		class="fixed inset-y-0 left-0 z-50 w-64 bg-surface p-6 shadow-xl border-r border-border md:hidden flex flex-col"
		aria-label="Navigasi mobile"
	>
		<div class="flex h-12 items-center mb-6">
			<SakalaLogo />
		</div>
		<div class="flex flex-col gap-1">
			{#each navigation as item (item.href)}
				<a
					href={`${base}${item.href}`}
					onclick={() => (isMobileOpen = false)}
					class={cn(
						'rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
						isActive(item.href) ? 'bg-primary-soft text-primary-dark font-semibold' : 'text-muted'
					)}
				>
					{item.label}
				</a>
			{/each}
			<div class="grid gap-2 grid-cols-2 absolute bottom-0 px-4 py-6">
				<Button variant="secondary" class="hover:bg-primary-soft hover:text-black transition-colors"
					>Setting</Button
				>
				<Button variant="secondary" class="hover:bg-primary-soft hover:text-black transition-colors"
					>Profile</Button
				>
			</div>
		</div>
	</nav>
{/if}

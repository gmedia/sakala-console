<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import SakalaLogo from '$lib/components/brand/SakalaLogo.svelte';
	import { cn } from '$lib/utils/cn';
	import { LayoutGrid, BookOpen, CircleUser, Settings } from '@lucide/svelte';

	type Props = {
		isMobileOpen?: boolean;
		onCloseMobile?: () => void;
	};

	let { isMobileOpen = false, onCloseMobile }: Props = $props();

	const navigation = [
		{ href: '/dashboard', label: 'Projects', icon: LayoutGrid },
		{ href: '/projects', label: 'User Guide', icon: BookOpen }
	] as const;

	function isActive(href: string): boolean {
		return page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
	}
</script>

<aside class="relative hidden h-full w-64 flex-col border-r border-border bg-surface md:flex">
	<div class="flex h-16 items-center border-b border-border px-6">
		<SakalaLogo />
	</div>
	<nav class="flex-1 space-y-1 px-4 py-6 pb-20 overflow-y-auto" aria-label="Navigasi utama">
		{#each navigation as item (item.href)}
			{@const Icon = item.icon}
			<a
				href={`${base}${item.href}`}
				aria-current={isActive(item.href) ? 'page' : undefined}
				class={cn(
					'flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
					isActive(item.href)
						? 'bg-primary-50 font-semibold text-primary-dark'
						: 'text-muted hover:bg-background-soft hover:text-foreground'
				)}
			>
				<Icon size={18} />
				<span>{item.label}</span>
			</a>
		{/each}
	</nav>
	<div
		class="absolute bottom-0 left-0 right-0 border-t border-border bg-surface px-4 py-4 flex items-center justify-between"
	>
		<div class="flex items-center gap-3 px-4">
			<CircleUser size={18} class="text-primary-dark shrink-0" />
			<span class="text-sm font-semibold text-foreground">Name</span>
		</div>
		<button
			type="button"
			class="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-background-soft hover:text-foreground transition-colors"
			aria-label="Pengaturan"
		>
			<Settings size={18} />
		</button>
	</div>
</aside>

{#if isMobileOpen}
	<button
		type="button"
		class="fixed inset-0 z-50 h-full w-full cursor-default bg-black/40 backdrop-blur-sm md:hidden"
		onclick={onCloseMobile}
		aria-label="Tutup menu"
	></button>

	<nav
		class="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-surface p-6 shadow-xl md:hidden"
		aria-label="Navigasi mobile"
	>
		<div class="mb-6 flex h-12 items-center">
			<SakalaLogo />
		</div>
		<div class="flex flex-col gap-1 pb-20">
			{#each navigation as item (item.href)}
				{@const Icon = item.icon}
				<a
					href={`${base}${item.href}`}
					onclick={onCloseMobile}
					class={cn(
						'flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
						isActive(item.href) ? 'bg-primary-soft font-semibold text-primary-dark' : 'text-muted'
					)}
				>
					<Icon size={18} />
					<span>{item.label}</span>
				</a>
			{/each}
		</div>

		<div
			class="absolute bottom-0 left-0 right-0 border-t border-border bg-surface px-4 py-4 flex items-center justify-between"
		>
			<div class="flex items-center gap-3 px-4">
				<CircleUser size={18} class="text-primary-dark shrink-0" />
				<span class="text-sm font-semibold text-foreground">Name</span>
			</div>
			<button
				type="button"
				class="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-background-soft hover:text-foreground transition-colors"
				aria-label="Pengaturan"
			>
				<Settings size={18} />
			</button>
		</div>
	</nav>
{/if}

<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import SakalaLogo from '$lib/components/brand/SakalaLogo.svelte';
	import { cn } from '$lib/utils/cn';
	import { SquaresFour, BookOpenText, User as UserIcon, CaretDown } from 'phosphor-svelte';
	import type { User } from '$lib/features/auth/types';

	type Props = {
		isMobileOpen?: boolean;
		onCloseMobile?: () => void;
		user?: Partial<User>;
	};

	let {
		isMobileOpen = false,
		onCloseMobile,
		user = { name: 'John Doe', email: 'john@sakala.dev' }
	}: Props = $props();

	type NavItem = {
		href: string;
		label: string;
		icon: typeof SquaresFour;
		isExternal?: boolean;
	};

	const navigation: readonly NavItem[] = [
		{ href: '/projects', label: 'Projects', icon: SquaresFour },
		{ href: 'https://sakala.dev/docs', label: 'User Guide', icon: BookOpenText, isExternal: true }
	];

	function isActive(item: NavItem): boolean {
		if (item.isExternal) return false;
		return page.url.pathname === item.href || page.url.pathname.startsWith(`${item.href}/`);
	}
</script>

<aside
	class="relative hidden h-[calc(100vh-48px)] w-66 flex-col rounded-2xl border border-border bg-surface shadow-xs md:flex"
>
	<div class="mt-7 ml-3 mr-16.5 mb-12">
		<SakalaLogo class="h-9.25 w-40.5" />
	</div>

	<nav class="flex-1 space-y-1 px-6" aria-label="Navigasi utama">
		{#each navigation as item (item.href)}
			{@const Icon = item.icon}
			<a
				href={item.isExternal ? item.href : `${base}${item.href}`}
				target={item.isExternal ? '_blank' : undefined}
				rel={item.isExternal ? 'noreferrer noopener' : undefined}
				aria-current={isActive(item) ? 'page' : undefined}
				class={cn(
					'flex h-14 w-54 items-center gap-3 rounded-lg px-4 font-sans text-base font-medium transition-colors',
					isActive(item)
						? 'bg-primary-50 font-semibold text-primary-dark'
						: 'text-muted hover:bg-background-soft hover:text-foreground'
				)}
			>
				<Icon size={24} class="size-6 shrink-0" />
				<span>{item.label}</span>
			</a>
		{/each}
	</nav>

	<div class="mt-auto px-6 py-4 flex items-center justify-between">
		<div class="flex items-center gap-3 min-w-0">
			{#if user.avatar_url}
				<img
					src={user.avatar_url}
					alt={user.name ?? 'User'}
					class="size-8 shrink-0 rounded-full object-cover ring-1 ring-border"
				/>
			{:else}
				<div
					class="flex size-8 shrink-0 items-center justify-center rounded-full bg-black/5 text-foreground"
				>
					<UserIcon size={18} class="size-4.5 text-black/70" />
				</div>
			{/if}
			<div class="flex flex-col min-w-0">
				<span class="truncate font-sans text-sm font-semibold text-foreground">
					{user.name ?? 'User'}
				</span>
				{#if user.email}
					<span class="truncate font-sans text-xs font-normal text-muted">{user.email}</span>
				{/if}
			</div>
		</div>
		<button
			type="button"
			class="flex items-center justify-center text-black/60 hover:text-foreground transition-colors shrink-0"
			aria-label="Menu profil"
		>
			<CaretDown size={16} class="size-4" />
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
		class="fixed inset-y-0 left-0 z-50 flex w-64 flex-col rounded-2xl border border-border bg-surface p-6 shadow-xl md:hidden"
		aria-label="Navigasi mobile"
	>
		<div class="mb-6 flex h-12 items-center">
			<SakalaLogo class="h-9.25 w-40.5" />
		</div>
		<div class="flex flex-col gap-1 pb-20">
			{#each navigation as item (item.href)}
				{@const Icon = item.icon}
				<a
					href={item.isExternal ? item.href : `${base}${item.href}`}
					target={item.isExternal ? '_blank' : undefined}
					rel={item.isExternal ? 'noreferrer noopener' : undefined}
					onclick={onCloseMobile}
					class={cn(
						'flex h-14 w-full items-center gap-3 rounded-lg px-4 font-sans text-base font-medium transition-colors',
						isActive(item)
							? 'bg-primary-50 font-semibold text-primary-dark'
							: 'text-muted hover:bg-background-soft hover:text-foreground'
					)}
				>
					<Icon size={24} class="size-6 shrink-0" />
					<span>{item.label}</span>
				</a>
			{/each}
		</div>

		<div class="mt-auto border-t border-border px-4 py-4 flex items-center justify-between">
			<div class="flex items-center gap-3 min-w-0">
				{#if user.avatar_url}
					<img
						src={user.avatar_url}
						alt={user.name ?? 'User'}
						class="size-8 shrink-0 rounded-full object-cover ring-1 ring-border"
					/>
				{:else}
					<div
						class="flex size-8 shrink-0 items-center justify-center rounded-full bg-black/10 text-foreground"
					>
						<UserIcon size={18} class="size-4.5 text-black/70" />
					</div>
				{/if}
				<div class="flex flex-col min-w-0">
					<span class="truncate font-sans text-sm font-semibold text-foreground">
						{user.name ?? 'User'}
					</span>
					{#if user.email}
						<span class="truncate font-sans text-xs font-normal text-muted">{user.email}</span>
					{/if}
				</div>
			</div>
			<button
				type="button"
				class="flex items-center justify-center text-black/60 hover:text-foreground transition-colors shrink-0"
				aria-label="Menu profil"
			>
				<CaretDown size={16} class="size-4" />
			</button>
		</div>
	</nav>
{/if}

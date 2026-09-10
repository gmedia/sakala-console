<script lang="ts">
	import { tick } from 'svelte';
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import SakalaLogo from '$lib/components/brand/SakalaLogo.svelte';
	import { cn } from '$lib/utils/cn';
	import {
		SquaresFour,
		BookOpenText,
		User as UserIcon,
		CaretDown,
		CaretUp,
		GearSix,
		SignOut
	} from 'phosphor-svelte';
	import type { User } from '$lib/features/auth/types';
	import { useCurrentUser } from '$lib/features/auth/queries';
	import { useLogout } from '$lib/features/auth/mutations';

	type Props = {
		isMobileOpen?: boolean;
		onCloseMobile?: () => void;
		user?: Partial<User>;
	};

	let {
		isMobileOpen = false,
		onCloseMobile,
		user: initialUser = { name: 'Sasongko', email: 'sasongkoahay@gmail.com' }
	}: Props = $props();

	const currentUserQuery = useCurrentUser();
	const user = $derived(currentUserQuery.data ?? initialUser);
	const logoutMutation = useLogout();

	let isProfileMenuOpen = $state(false);
	let isLogoutModalOpen = $state(false);
	let profileContainerRef = $state<HTMLElement | null>(null);

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

	function isActive(href: string): boolean {
		return page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
	}

	function isItemActive(item: NavItem): boolean {
		if (item.isExternal) return false;
		return isActive(item.href);
	}

	function handleClickOutside(event: MouseEvent) {
		if (
			isProfileMenuOpen &&
			profileContainerRef &&
			!profileContainerRef.contains(event.target as Node)
		) {
			isProfileMenuOpen = false;
		}
	}

	let lastLogoutTrigger: HTMLElement | null = null;

	function openLogoutModal(e?: MouseEvent | KeyboardEvent) {
		lastLogoutTrigger =
			(e?.currentTarget as HTMLElement) ?? (document.activeElement as HTMLElement);
		isProfileMenuOpen = false;
		isLogoutModalOpen = true;
	}

	async function closeLogoutModal() {
		isLogoutModalOpen = false;
		await tick();
		lastLogoutTrigger?.focus();
	}

	function logoutModalTrap(node: HTMLElement) {
		const focusableSelector =
			'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === 'Escape') {
				e.preventDefault();
				closeLogoutModal();
				return;
			}

			if (e.key === 'Tab') {
				const focusables = Array.from(node.querySelectorAll<HTMLElement>(focusableSelector));
				if (focusables.length === 0) return;

				const first = focusables[0];
				const last = focusables[focusables.length - 1];

				if (e.shiftKey && document.activeElement === first) {
					e.preventDefault();
					last.focus();
				} else if (!e.shiftKey && document.activeElement === last) {
					e.preventDefault();
					first.focus();
				}
			}
		}

		tick().then(() => {
			node.focus();
			const firstFocusable = node.querySelector<HTMLElement>(focusableSelector);
			firstFocusable?.focus();
		});

		window.addEventListener('keydown', handleKeyDown);

		return {
			destroy() {
				window.removeEventListener('keydown', handleKeyDown);
			}
		};
	}

	function handleConfirmLogout() {
		isLogoutModalOpen = false;
		logoutMutation.mutate();
	}

	function handleNavigationClick() {
		isProfileMenuOpen = false;
		if (onCloseMobile) onCloseMobile();
	}
</script>

<svelte:window onclick={handleClickOutside} />

{#snippet profileMenu()}
	{#if isProfileMenuOpen}
		<div
			class="absolute bottom-full left-0 right-0 mb-3 z-50 rounded-2xl border border-border/80 bg-white p-2.5 shadow-xl transition-all"
		>
			<div class="px-3 py-2">
				<p class="font-sans text-sm font-semibold text-foreground truncate">
					{user.name || (user.email ? user.email.split('@')[0] : 'Sasongko')}
				</p>
				{#if user.email}
					<p class="font-sans text-xs text-muted truncate">{user.email}</p>
				{/if}
			</div>

			<div class="my-1.5 border-b border-border/60"></div>

			<div class="space-y-1">
				<a
					href={`${base}/profile`}
					onclick={handleNavigationClick}
					class={cn(
						'flex items-center gap-3 rounded-lg px-3 py-2.5 font-sans text-sm font-medium transition-colors',
						isActive('/profile')
							? 'bg-primary-50 text-primary-dark font-semibold'
							: 'text-foreground hover:bg-background-soft'
					)}
				>
					<UserIcon size={18} class="size-4.5 shrink-0" />
					<span>Lihat Profil</span>
				</a>

				<a
					href={`${base}/settings`}
					onclick={handleNavigationClick}
					class={cn(
						'flex items-center gap-3 rounded-lg px-3 py-2.5 font-sans text-sm font-medium transition-colors',
						isActive('/settings')
							? 'bg-primary-50 text-primary-dark font-semibold'
							: 'text-foreground hover:bg-background-soft'
					)}
				>
					<GearSix size={18} class="size-4.5 shrink-0" />
					<span>Pengaturan</span>
				</a>
			</div>

			<div class="my-1.5 border-b border-border/60"></div>

			<button
				type="button"
				onclick={(e) => openLogoutModal(e)}
				class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 font-sans text-sm font-medium text-error-base transition-colors hover:bg-error/10 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error-base"
			>
				<SignOut size={18} class="size-4.5 shrink-0" />
				<span>Keluar</span>
			</button>
		</div>
	{/if}
{/snippet}

{#snippet profileTrigger()}
	<button
		type="button"
		onclick={() => (isProfileMenuOpen = !isProfileMenuOpen)}
		class={cn(
			'flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-all cursor-pointer',
			isProfileMenuOpen
				? 'border-primary/40 bg-primary-50 shadow-xs'
				: 'border-border/60 bg-surface hover:bg-primary-50'
		)}
		aria-expanded={isProfileMenuOpen}
		aria-label="Menu akun pengguna"
	>
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
					{user.name || (user.email ? user.email.split('@')[0] : 'Sasongko')}
				</span>
				{#if user.email}
					<span class="truncate font-sans text-xs font-normal text-muted">{user.email}</span>
				{/if}
			</div>
		</div>
		{#if isProfileMenuOpen}
			<CaretUp size={16} class="size-4 shrink-0 text-foreground" />
		{:else}
			<CaretDown size={16} class="size-4 shrink-0 text-muted" />
		{/if}
	</button>
{/snippet}

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
				aria-current={isItemActive(item) ? 'page' : undefined}
				class={cn(
					'flex h-14 w-54 items-center gap-3 rounded-lg px-4 font-sans text-base font-medium transition-colors',
					isItemActive(item)
						? 'bg-primary-50 font-semibold text-primary-dark'
						: 'text-muted hover:bg-background-soft hover:text-foreground'
				)}
			>
				<Icon size={24} class="size-6 shrink-0" />
				<span>{item.label}</span>
			</a>
		{/each}
	</nav>

	<div class="relative mt-auto px-6 py-4" bind:this={profileContainerRef}>
		{@render profileMenu()}
		{@render profileTrigger()}
	</div>
</aside>

{#if isMobileOpen}
	<button
		type="button"
		class="fixed inset-0 z-50 h-full w-full cursor-default bg-black/40 backdrop-blur-xs md:hidden"
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
						isItemActive(item)
							? 'bg-primary-50 font-semibold text-primary-dark'
							: 'text-muted hover:bg-background-soft hover:text-foreground'
					)}
				>
					<Icon size={24} class="size-6 shrink-0" />
					<span>{item.label}</span>
				</a>
			{/each}
		</div>

		<div class="relative mt-auto border-t border-border pt-4">
			{@render profileMenu()}
			{@render profileTrigger()}
		</div>
	</nav>
{/if}

{#if isLogoutModalOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
		role="dialog"
		aria-modal="true"
		aria-labelledby="logout-dialog-title"
		tabindex="-1"
		use:logoutModalTrap
	>
		<button
			type="button"
			class="absolute inset-0 h-full w-full cursor-default"
			onclick={closeLogoutModal}
			aria-label="Tutup modal konfirmasi"
		></button>
		<div
			class="relative z-10 flex w-full max-w-xs flex-col items-center gap-6 rounded-2xl bg-white p-6 text-center shadow-xl border border-border/80"
		>
			<h3 id="logout-dialog-title" class="font-sans text-base font-semibold text-foreground">
				Yakin Ingin Keluar Akun?
			</h3>
			<div class="flex w-full items-center justify-center gap-3">
				<button
					type="button"
					onclick={closeLogoutModal}
					disabled={logoutMutation.isPending}
					class="flex-1 rounded-lg bg-primary-dark py-2.5 font-sans text-sm font-semibold text-white transition-colors hover:bg-primary-dark/90 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-dark focus-visible:ring-offset-2"
				>
					Tidak
				</button>
				<button
					type="button"
					onclick={handleConfirmLogout}
					disabled={logoutMutation.isPending}
					class="flex-1 rounded-lg border border-border/80 py-2.5 font-sans text-sm font-semibold text-foreground transition-colors hover:bg-background-soft cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-dark focus-visible:ring-offset-2"
				>
					{logoutMutation.isPending ? 'Keluar...' : 'Iya'}
				</button>
			</div>
		</div>
	</div>
{/if}

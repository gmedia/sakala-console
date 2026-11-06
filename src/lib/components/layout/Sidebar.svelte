<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import SakalaLogo from '$lib/assets/sakala-logo-green.svg';
	import { cn } from '$lib/utils/cn';
	import SquaresFour from 'phosphor-svelte/lib/SquaresFour';
	import BookOpenText from 'phosphor-svelte/lib/BookOpenText';
	import ChatCircleText from 'phosphor-svelte/lib/ChatCircleText';
	import UserIcon from 'phosphor-svelte/lib/User';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';
	import CaretUp from 'phosphor-svelte/lib/CaretUp';
	import GearSix from 'phosphor-svelte/lib/GearSix';
	import SignOut from 'phosphor-svelte/lib/SignOut';
	import X from 'phosphor-svelte/lib/X';
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import { MediaQuery } from 'svelte/reactivity';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import type { User } from '$lib/features/auth/types';
	import { useCurrentUser } from '$lib/features/auth/queries';
	import { useLogout } from '$lib/features/auth/mutations';
	import { feedbackPath } from '$lib/features/feedback/context';

	type Props = {
		isMobileOpen?: boolean;
		onCloseMobile?: () => void;
		user?: Partial<User>;
	};

	let { isMobileOpen = false, onCloseMobile, user: initialUser = {} }: Props = $props();

	const currentUserQuery = useCurrentUser();
	const user = $derived(currentUserQuery.data ?? initialUser);
	const logoutMutation = useLogout();

	let isProfileMenuOpen = $state(false);
	let isLogoutModalOpen = $state(false);
	let desktopProfileContainerRef = $state<HTMLElement | null>(null);
	let mobileProfileContainerRef = $state<HTMLElement | null>(null);
	let profileTriggerRef = $state<HTMLElement | null>(null);
	let logoutErrorMessage = $state<string | null>(null);

	type NavItem = {
		href: string;
		label: string;
		icon: typeof SquaresFour;
		isExternal?: boolean;
	};

	// Feedback opens from the project or deployment on screen, and the form lets the user remove it.
	const navigation: readonly NavItem[] = $derived([
		{ href: '/projects', label: 'Proyek', icon: SquaresFour },
		{
			href: feedbackPath('/feedback', {
				projectId: page.params.id,
				deploymentId: page.params.deploymentId
			}),
			label: 'Kirim Masukan',
			icon: ChatCircleText
		},
		{
			href: 'https://sakala.dev/docs/deploy-pertama',
			label: 'Panduan',
			icon: BookOpenText,
			isExternal: true
		}
	]);

	function isActive(href: string): boolean {
		const path = href.split('?')[0];
		return page.url.pathname === path || page.url.pathname.startsWith(`${path}/`);
	}

	function isItemActive(item: NavItem): boolean {
		if (item.isExternal) return false;
		return isActive(item.href);
	}

	function handleClickOutside(event: MouseEvent) {
		if (!isProfileMenuOpen) return;
		const target = event.target as Node;
		const isInsideDesktop = desktopProfileContainerRef?.contains(target);
		const isInsideMobile = mobileProfileContainerRef?.contains(target);

		if (!isInsideDesktop && !isInsideMobile) {
			isProfileMenuOpen = false;
		}
	}

	function openLogoutModal() {
		isProfileMenuOpen = false;
		logoutErrorMessage = null;
		isLogoutModalOpen = true;
	}

	function handleConfirmLogout() {
		logoutErrorMessage = null;
		logoutMutation.mutate(undefined, {
			onSuccess: () => {
				isLogoutModalOpen = false;
			},
			onError: (error: unknown) => {
				const err = error as { status?: number; response?: { status?: number } };
				if (err?.status === 401 || err?.response?.status === 401) {
					isLogoutModalOpen = false;
					return;
				}
				logoutErrorMessage = 'Gagal keluar akun. Silakan coba lagi.';
			}
		});
	}

	function handleNavigationClick() {
		isProfileMenuOpen = false;
		if (onCloseMobile) onCloseMobile();
	}

	// Past this width the drawer is hidden, and a hidden dialog would still hold focus and scroll.
	const isDesktop = new MediaQuery('min-width: 768px', false);
	$effect(() => {
		if (isDesktop.current && isMobileOpen) onCloseMobile?.();
	});

	function handleDrawerCloseFocus(event: Event) {
		event.preventDefault();
		document.getElementById('mobile-nav-toggle')?.focus();
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
					{user.name || user.username || (user.email ? user.email.split('@')[0] : 'User')}
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
				onclick={openLogoutModal}
				class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 font-sans text-sm font-medium text-error transition-colors hover:bg-error/10 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error"
			>
				<SignOut size={18} class="size-4.5 shrink-0" />
				<span>Keluar</span>
			</button>
		</div>
	{/if}
{/snippet}

{#snippet profileTrigger()}
	<button
		bind:this={profileTriggerRef}
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
					<UserIcon size={18} class="size-4.5 text-foreground/70" />
				</div>
			{/if}
			<div class="flex flex-col min-w-0">
				<span class="truncate font-sans text-sm font-semibold text-foreground">
					{user.name || user.username || (user.email ? user.email.split('@')[0] : 'User')}
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
	<div class="mt-7 mb-10 px-6">
		<a href={`${base}/projects`} class="inline-block" aria-label="Sakala">
			<img src={SakalaLogo} alt="" class="h-10 w-auto object-contain" />
		</a>
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

	<div class="relative mt-auto px-6 py-4" bind:this={desktopProfileContainerRef}>
		{@render profileMenu()}
		{@render profileTrigger()}
	</div>
</aside>

<DialogPrimitive.Root
	bind:open={
		() => isMobileOpen,
		(next) => {
			if (!next) onCloseMobile?.();
		}
	}
>
	<DialogPrimitive.Portal>
		<DialogPrimitive.Overlay class="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs md:hidden" />
		<DialogPrimitive.Content
			onCloseAutoFocus={handleDrawerCloseFocus}
			class="fixed inset-y-0 left-0 z-50 flex w-64 max-w-[calc(100vw-2rem)] flex-col rounded-r-2xl border border-border bg-surface p-6 shadow-xl md:hidden"
		>
			<DialogPrimitive.Title class="sr-only">Navigasi</DialogPrimitive.Title>
			<DialogPrimitive.Close
				aria-label="Tutup menu"
				class="absolute top-3 right-3 flex size-11 cursor-pointer items-center justify-center rounded-lg text-foreground hover:bg-background-soft"
			>
				<X size={20} />
			</DialogPrimitive.Close>

			<nav class="flex min-h-0 flex-1 flex-col" aria-label="Navigasi mobile">
				<div class="mt-2 mb-10">
					<a
						href={`${base}/projects`}
						onclick={onCloseMobile}
						class="inline-block"
						aria-label="Sakala"
					>
						<img src={SakalaLogo} alt="" class="h-10 w-auto object-contain" />
					</a>
				</div>
				<div class="flex flex-col gap-1 pb-20">
					{#each navigation as item (item.href)}
						{@const Icon = item.icon}
						<a
							href={item.isExternal ? item.href : `${base}${item.href}`}
							target={item.isExternal ? '_blank' : undefined}
							rel={item.isExternal ? 'noreferrer noopener' : undefined}
							onclick={onCloseMobile}
							aria-current={isItemActive(item) ? 'page' : undefined}
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

				<div
					class="relative mt-auto border-t border-border pt-4"
					bind:this={mobileProfileContainerRef}
				>
					{@render profileMenu()}
					{@render profileTrigger()}
				</div>
			</nav>
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>

<Dialog
	bind:open={isLogoutModalOpen}
	title="Yakin Ingin Keluar Akun?"
	titleClass="text-base text-center"
	class="max-w-xs"
	cancelLabel="Tidak"
	confirmLabel={logoutMutation.isPending ? 'Keluar...' : logoutErrorMessage ? 'Coba Lagi' : 'Iya'}
	emphasis="cancel"
	loading={logoutMutation.isPending}
	returnFocus={() => profileTriggerRef}
	onConfirm={handleConfirmLogout}
	onCancel={() => (logoutErrorMessage = null)}
>
	{#if logoutErrorMessage}
		<p
			class="text-xs text-error font-medium bg-error/10 py-1.5 px-3 rounded-lg border border-error/20"
			role="alert"
		>
			{logoutErrorMessage}
		</p>
	{/if}
</Dialog>

<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import { MediaQuery } from 'svelte/reactivity';
	import ChartLine from 'phosphor-svelte/lib/ChartLine';
	import Users from 'phosphor-svelte/lib/Users';
	import UsersThree from 'phosphor-svelte/lib/UsersThree';
	import Sliders from 'phosphor-svelte/lib/Sliders';
	import SquaresFour from 'phosphor-svelte/lib/SquaresFour';
	import WarningOctagon from 'phosphor-svelte/lib/WarningOctagon';
	import HardDrives from 'phosphor-svelte/lib/HardDrives';
	import ChatCircleText from 'phosphor-svelte/lib/ChatCircleText';
	import ClipboardText from 'phosphor-svelte/lib/ClipboardText';
	import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft';
	import X from 'phosphor-svelte/lib/X';
	import SakalaLogo from '$lib/components/brand/SakalaLogo.svelte';
	import { useCurrentUser } from '$lib/features/auth/queries';
	import { cn } from '$lib/utils/cn';

	type Props = { isMobileOpen?: boolean; onCloseMobile?: () => void };
	let { isMobileOpen = false, onCloseMobile }: Props = $props();

	const currentUser = useCurrentUser();

	// Paths stay literal so `resolve` checks each one against the route tree.
	const navigation = [
		{ href: resolve('/admin'), match: ['/admin'], label: 'Overview', icon: ChartLine, exact: true },
		{ href: resolve('/admin/users'), match: ['/admin/users'], label: 'Pengguna', icon: Users },
		{
			href: resolve('/admin/workspaces'),
			match: ['/admin/workspaces'],
			label: 'Workspace',
			icon: UsersThree
		},
		{
			href: resolve('/admin/limit-profiles'),
			match: ['/admin/limit-profiles'],
			label: 'Profil batas',
			icon: Sliders
		},
		{
			href: resolve('/admin/projects'),
			match: ['/admin/projects'],
			label: 'Proyek',
			icon: SquaresFour
		},
		{
			href: resolve('/admin/failures'),
			match: ['/admin/failures', '/admin/deployments'],
			label: 'Analisis kegagalan',
			icon: WarningOctagon
		},
		{
			href: resolve('/admin/agents'),
			match: ['/admin/agents'],
			label: 'Runtime node',
			icon: HardDrives
		},
		{
			href: resolve('/admin/feedback'),
			match: ['/admin/feedback'],
			label: 'Masukan',
			icon: ChatCircleText
		},
		{ href: resolve('/admin/audit'), match: ['/admin/audit'], label: 'Audit', icon: ClipboardText }
	];

	function isActive(item: (typeof navigation)[number]): boolean {
		const path = page.url.pathname;
		return item.match.some((prefix) =>
			item.exact ? path === prefix : path === prefix || path.startsWith(`${prefix}/`)
		);
	}

	const isDesktop = new MediaQuery('min-width: 1024px', false);
	$effect(() => {
		if (isDesktop.current && isMobileOpen) onCloseMobile?.();
	});

	function handleDrawerCloseFocus(event: Event) {
		event.preventDefault();
		document.getElementById('admin-nav-toggle')?.focus();
	}
</script>

{#snippet links(onNavigate?: () => void)}
	<ul class="flex flex-col gap-1">
		{#each navigation as item (item.href)}
			{@const Icon = item.icon}
			<li>
				<a
					href={item.href}
					onclick={onNavigate}
					aria-current={isActive(item) ? 'page' : undefined}
					class={cn(
						'flex h-11 w-full items-center gap-3 rounded-control px-3 text-sm font-medium transition-colors',
						isActive(item)
							? 'bg-primary-50 font-semibold text-primary-dark'
							: 'text-muted hover:bg-background-soft hover:text-foreground'
					)}
				>
					<Icon size={20} class="shrink-0" aria-hidden="true" />
					<span>{item.label}</span>
				</a>
			</li>
		{/each}
	</ul>
{/snippet}

{#snippet footer()}
	<div class="flex flex-col gap-3 border-t border-border pt-4">
		<div class="flex min-w-0 items-center justify-between gap-2 px-3">
			<span class="truncate text-sm font-semibold text-foreground">
				{currentUser.data?.name ?? ''}
			</span>
			<span class="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-dark">
				Admin
			</span>
		</div>
		<a
			href={resolve('/projects')}
			class="flex h-11 items-center gap-3 rounded-control px-3 text-sm font-medium text-foreground hover:bg-background-soft"
		>
			<ArrowLeft size={18} aria-hidden="true" />
			Kembali ke Console
		</a>
	</div>
{/snippet}

<aside
	class="relative hidden h-full w-64 shrink-0 flex-col rounded-card border border-border bg-surface p-3 lg:flex"
>
	<div class="mt-3 mb-6 px-2">
		<SakalaLogo class="h-10" />
		<p class="mt-2 text-xs font-semibold tracking-wide text-muted uppercase">Area admin</p>
	</div>
	<nav class="flex-1 overflow-y-auto" aria-label="Navigasi admin">
		{@render links()}
	</nav>
	{@render footer()}
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
		<DialogPrimitive.Overlay class="fixed inset-0 z-50 bg-scrim/40 lg:hidden" />
		<DialogPrimitive.Content
			onCloseAutoFocus={handleDrawerCloseFocus}
			class="fixed inset-y-0 left-0 z-50 flex w-64 max-w-[calc(100vw-2rem)] flex-col rounded-r-overlay border border-border bg-surface p-4 shadow-overlay lg:hidden"
		>
			<DialogPrimitive.Title class="sr-only">Navigasi admin</DialogPrimitive.Title>
			<DialogPrimitive.Close
				aria-label="Tutup menu"
				class="absolute top-3 right-3 flex size-11 cursor-pointer items-center justify-center rounded-control text-foreground hover:bg-background-soft"
			>
				<X size={20} aria-hidden="true" />
			</DialogPrimitive.Close>
			<div class="mt-1 mb-6 px-2">
				<SakalaLogo class="h-10" />
				<p class="mt-2 text-xs font-semibold tracking-wide text-muted uppercase">Area admin</p>
			</div>
			<nav class="min-h-0 flex-1 overflow-y-auto" aria-label="Navigasi admin mobile">
				{@render links(onCloseMobile)}
			</nav>
			{@render footer()}
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>

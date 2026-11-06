<script lang="ts">
	import List from 'phosphor-svelte/lib/List';
	import { page } from '$app/state';
	import SakalaLogo from '$lib/components/brand/SakalaLogo.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { useCurrentUser } from '$lib/features/auth/queries';
	import { createUnreadNotificationCountQuery } from '$lib/features/notifications/queries';
	import { useNotificationsLive } from '$lib/features/notifications/use-notifications-live.svelte';
	import NotificationPopover from '$lib/features/notifications/components/NotificationPopover.svelte';
	import { createProjectQuery } from '$lib/features/projects/queries';

	type Props = {
		onToggleMobile?: () => void;
	};

	let { onToggleMobile }: Props = $props();

	const currentUser = useCurrentUser();
	const unreadCountQuery = createUnreadNotificationCountQuery();

	useNotificationsLive(() => currentUser.data?.id ?? null);

	const projectQuery = createProjectQuery(() => page.params.id ?? '');
	const currentProject = $derived(page.params.id ? projectQuery.data : null);
	const projectName = $derived(currentProject?.name ?? currentProject?.project_name ?? '');

	// The one page heading. Pages below it do not repeat it.
	const pageTitle = $derived.by(() => {
		const path = page.url.pathname;
		if (path.startsWith('/notifications')) return 'Notifikasi';
		if (path.startsWith('/profile')) return 'Profil saya';
		if (path.startsWith('/settings')) return 'Pengaturan';
		if (path.startsWith('/feedback')) return 'Kirim masukan';
		if (path.startsWith('/projects/new')) return 'Proyek baru';
		return 'Proyek';
	});
</script>

<header class="mb-6 lg:mb-8">
	<div class="mx-auto flex w-full max-w-page items-center justify-between gap-3">
		<div class="flex min-w-0 items-center gap-2 lg:gap-3">
			<Button
				id="mobile-nav-toggle"
				variant="ghost"
				size="icon"
				class="-ml-2 text-foreground lg:hidden"
				onclick={onToggleMobile}
				aria-label="Buka navigasi"
			>
				<List size={20} aria-hidden="true" />
			</Button>
			<SakalaLogo lockup="mark" class="size-7 lg:hidden" />

			<h1 class="flex min-w-0 flex-wrap items-center gap-x-1.5 text-base sm:text-xl">
				{#if page.params.id}
					<span class="font-medium text-muted">Proyek</span>
					<span class="font-medium text-muted">/</span>
					<span class="line-clamp-2 min-w-0 wrap-anywhere text-foreground" title={projectName}
						>{projectName || '...'}</span
					>
				{:else}
					<span class="text-foreground">{pageTitle}</span>
				{/if}
			</h1>
		</div>

		<NotificationPopover unreadCount={unreadCountQuery.data ?? 0} />
	</div>
</header>

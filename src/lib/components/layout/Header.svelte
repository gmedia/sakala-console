<script lang="ts">
	import List from 'phosphor-svelte/lib/List';
	import { page } from '$app/state';
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

	const pageTitle = $derived.by(() => {
		const path = page.url.pathname;
		if (path.startsWith('/notifications')) return 'Notifikasi';
		if (path.startsWith('/profile')) return 'Akun / Profil Saya';
		if (path.startsWith('/settings')) return 'Akun / Pengaturan';
		if (path.startsWith('/feedback')) return 'Kirim Masukan';
		if (path.startsWith('/projects/new')) return 'Proyek Baru';
		return 'Proyek';
	});
</script>

<header class="mb-8 flex items-center justify-between bg-transparent">
	<div class="mx-auto flex w-full max-w-7xl items-center justify-between gap-3">
		<div class="flex min-w-0 items-center gap-3">
			<button
				type="button"
				id="mobile-nav-toggle"
				class="inline-flex size-11 shrink-0 items-center justify-center rounded-lg bg-surface text-foreground md:hidden"
				onclick={onToggleMobile}
				aria-label="Buka navigasi"
			>
				<List size={20} />
			</button>

			<h1 class="flex min-w-0 flex-wrap items-center gap-x-1.5 font-sans text-lg tracking-tight">
				{#if page.params.id}
					<span class="text-muted font-medium">Proyek</span>
					<span class="text-foreground font-medium">/</span>
					<span
						class="line-clamp-2 min-w-0 font-semibold wrap-anywhere text-foreground"
						title={projectName}>{projectName || '...'}</span
					>
				{:else}
					<span class="font-semibold text-foreground">{pageTitle}</span>
				{/if}
			</h1>
		</div>

		<div class="flex items-center gap-4">
			<NotificationPopover unreadCount={unreadCountQuery.data ?? 0} />
		</div>
	</div>
</header>

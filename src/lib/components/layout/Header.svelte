<script lang="ts">
	import { List } from 'phosphor-svelte';
	import { page } from '$app/state';
	import { createUnreadNotificationCountQuery } from '$lib/features/notifications/queries';
	import NotificationPopover from '$lib/features/notifications/components/NotificationPopover.svelte';
	import type { NotificationItem } from '$lib/features/notifications/types';

	type Props = {
		onToggleMobile?: () => void;
		hasUnread?: boolean;
		unreadCount?: number;
		notifications?: NotificationItem[];
	};

	let { onToggleMobile, hasUnread, unreadCount, notifications }: Props = $props();

	const notificationQuery = createUnreadNotificationCountQuery();

	const isUnread = $derived(
		hasUnread ??
			(notificationQuery.data?.has_unread ||
				(notificationQuery.data?.unread_count ?? 0) > 0 ||
				(unreadCount ?? 0) > 0)
	);

	const pageTitle = $derived(
		page.url.pathname.startsWith('/notifications')
			? 'Notifikasi'
			: page.url.pathname.startsWith('/settings')
				? 'Pengaturan'
				: 'Projects'
	);
</script>

<header class="mb-8 flex items-center justify-between bg-transparent">
	<div class="mx-auto flex w-full max-w-7xl items-center justify-between">
		<div class="flex items-center gap-3">
			<button
				type="button"
				class="inline-flex size-10 items-center justify-center rounded-lg bg-white text-black md:hidden"
				onclick={onToggleMobile}
				aria-label="Buka navigasi"
			>
				<List size={20} />
			</button>

			<h1 class="font-sans text-lg font-semibold tracking-tight text-foreground">
				{pageTitle}
			</h1>
		</div>

		<div class="flex items-center gap-4">
			<NotificationPopover hasUnread={isUnread} {notifications} />
		</div>
	</div>
</header>

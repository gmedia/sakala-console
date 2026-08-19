<script lang="ts">
	import { Bell, List } from 'phosphor-svelte';
	import { page } from '$app/state';
	import { createUnreadNotificationCountQuery } from '$lib/features/notifications/queries';

	type Props = {
		onToggleMobile?: () => void;
		hasUnread?: boolean;
		unreadCount?: number;
	};

	let { onToggleMobile, hasUnread, unreadCount }: Props = $props();

	const notificationQuery = createUnreadNotificationCountQuery();

	const isUnread = $derived(
		hasUnread ??
			(notificationQuery.data?.has_unread ||
				(notificationQuery.data?.unread_count ?? 0) > 0 ||
				(unreadCount ?? 0) > 0)
	);

	const pageTitle = $derived(page.url.pathname.startsWith('/projects') ? 'Projects' : 'Projects');
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
			<button
				type="button"
				class="relative flex size-10 items-center justify-center rounded-lg bg-white shadow-xs transition-colors hover:bg-white/90"
				aria-label="Buka notifikasi"
			>
				<Bell size={24} class="size-6 text-black" />
				{#if isUnread}
					<span
						class="absolute top-2 right-2 size-2 rounded-full bg-error ring-2 ring-white"
						aria-hidden="true"
					></span>
				{/if}
			</button>
		</div>
	</div>
</header>

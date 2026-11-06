<script lang="ts">
	import { Popover } from 'bits-ui';
	import Bell from 'phosphor-svelte/lib/Bell';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { Notification } from '$lib/api/resources/notifications';
	import { getErrorMessage } from '$lib/api/errors';
	import { useMarkNotificationRead } from '../mutations';
	import { notificationHref } from '../presentation';
	import { createNotificationsQuery } from '../queries';
	import NotificationItemRow from './NotificationItemRow.svelte';
	import NotificationEmptyState from './NotificationEmptyState.svelte';

	const LATEST_COUNT = 10;

	type Props = {
		open?: boolean;
		unreadCount?: number;
	};

	let { open = $bindable(false), unreadCount = 0 }: Props = $props();

	const notificationsQuery = createNotificationsQuery(
		() => ({ page: 1, perPage: LATEST_COUNT }),
		() => open
	);
	const markRead = useMarkNotificationRead();

	const notifications = $derived(notificationsQuery.data?.data ?? []);

	function handleItemClick(notification: Notification) {
		if (notification.read_at === null) markRead.mutate(notification.id);
		open = false;
		const target = notificationHref(notification) ?? '/notifications';
		goto(resolve(target as '/projects')).catch(() => {});
	}

	function handleSeeAll() {
		open = false;
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger
		class="relative flex size-10 items-center justify-center rounded-lg bg-white shadow-xs transition-colors hover:bg-white/90 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-dark"
		aria-label={unreadCount > 0
			? `Buka notifikasi, ${unreadCount} belum dibaca`
			: 'Buka notifikasi'}
	>
		<Bell size={24} class="size-6 text-black" />
		{#if unreadCount > 0}
			<span
				data-testid="bell-unread-dot"
				class="inline-block absolute top-2 right-2 size-2 rounded-full bg-error ring-2 ring-white"
				aria-hidden="true"
			></span>
		{/if}
	</Popover.Trigger>

	<Popover.Portal>
		<Popover.Content
			side="bottom"
			align="end"
			sideOffset={8}
			class="z-50 w-[420px] max-w-[calc(100vw-32px)] rounded-2xl border border-border/80 bg-white p-5 shadow-xl focus:outline-none"
		>
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<h3 class="font-sans text-base font-semibold text-foreground">Notifikasi</h3>
					<a
						href={resolve('/notifications')}
						onclick={handleSeeAll}
						class="shrink-0 font-sans text-xs font-semibold text-primary-dark hover:underline"
					>
						Lihat Semua
					</a>
				</div>

				{#if notificationsQuery.isPending}
					<p class="py-6 text-center font-sans text-xs text-muted" role="status">
						Memuat notifikasi...
					</p>
				{:else if notificationsQuery.isError}
					<div class="space-y-2 py-6 text-center" role="alert">
						<p class="font-sans text-xs text-error-base">
							{getErrorMessage(notificationsQuery.error, 'Gagal memuat notifikasi.')}
						</p>
						<button
							type="button"
							onclick={() => notificationsQuery.refetch()}
							class="font-sans text-xs font-semibold text-primary-dark hover:underline cursor-pointer"
						>
							Coba lagi
						</button>
					</div>
				{:else if notifications.length > 0}
					<div
						class="max-h-[380px] space-y-1 overflow-y-auto pr-1 focus:outline-none"
						role="group"
						aria-label="Daftar notifikasi"
					>
						{#each notifications as notification (notification.id)}
							<NotificationItemRow {notification} onClick={handleItemClick} />
						{/each}
					</div>
				{:else}
					<NotificationEmptyState />
				{/if}
			</div>
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>

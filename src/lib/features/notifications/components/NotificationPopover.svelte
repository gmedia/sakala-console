<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import { Popover } from 'bits-ui';
	import { buttonClasses } from '$lib/components/ui/button-classes';
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
		class={buttonClasses('secondary', 'icon', 'relative')}
		aria-label={unreadCount > 0
			? `Buka notifikasi, ${unreadCount} belum dibaca`
			: 'Buka notifikasi'}
	>
		<Bell size={20} class="text-foreground" aria-hidden="true" />
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
			class="z-50 w-105 max-w-[calc(100vw-2rem)] rounded-overlay border border-border bg-surface p-4 shadow-overlay focus:outline-none sm:p-5"
		>
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<h2 class="text-base text-foreground">Notifikasi</h2>
					<a
						href={resolve('/notifications')}
						onclick={handleSeeAll}
						class="inline-flex min-h-6 shrink-0 items-center text-sm font-semibold text-primary-dark hover:underline"
					>
						Lihat semua
					</a>
				</div>

				{#if notificationsQuery.isPending}
					<p class="py-6 text-center text-xs text-muted" role="status">Memuat notifikasi...</p>
				{:else if notificationsQuery.isError}
					<div class="space-y-2 py-6 text-center" role="alert">
						<p class="text-xs text-error-base">
							{getErrorMessage(notificationsQuery.error, 'Gagal memuat notifikasi.')}
						</p>
						<Button variant="link" onclick={() => notificationsQuery.refetch()}>Coba lagi</Button>
					</div>
				{:else if notifications.length > 0}
					<div
						class="max-h-[min(60dvh,24rem)] space-y-1 overflow-y-auto pr-1"
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

<script lang="ts">
	import { Popover } from 'bits-ui';
	import { Bell, MagnifyingGlass, X } from 'phosphor-svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { SvelteSet } from 'svelte/reactivity';
	import type { NotificationItem } from '../types';
	import { notificationStore } from '../store.svelte';
	import NotificationItemRow from './NotificationItemRow.svelte';
	import NotificationEmptyState from './NotificationEmptyState.svelte';

	type Props = {
		open?: boolean;
		notifications?: NotificationItem[];
		hasUnread?: boolean;
		onSelectNotification?: (item: NotificationItem) => void;
	};

	let {
		open = $bindable(false),
		notifications: customNotifications,
		hasUnread,
		onSelectNotification
	}: Props = $props();

	let readIds = new SvelteSet<string>();

	const sourceNotifications = $derived(customNotifications ?? notificationStore.all);

	const items = $derived(
		sourceNotifications.map((item) =>
			readIds.has(item.id) || item.is_read ? { ...item, is_read: true } : item
		)
	);

	let searchQuery = $state('');

	const filteredNotifications = $derived(
		searchQuery.trim() === ''
			? items
			: items.filter((item) =>
					item.message.toLowerCase().includes(searchQuery.trim().toLowerCase())
				)
	);

	const isBellUnread = $derived(hasUnread ?? items.some((item) => !item.is_read));

	function handleItemClick(clickedItem: NotificationItem) {
		notificationStore.markAsRead(clickedItem.id);
		readIds.add(clickedItem.id);
		open = false;
		goto(resolve(`/notifications?id=${clickedItem.id}` as '/projects')).catch(() => {});
		onSelectNotification?.(clickedItem);
	}

	function handleClearSearch() {
		searchQuery = '';
	}

	function handleSeeAll() {
		open = false;
		goto(resolve('/notifications' as '/projects'));
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger
		class="relative flex size-10 items-center justify-center rounded-lg bg-white shadow-xs transition-colors hover:bg-white/90 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-dark"
		aria-label="Buka notifikasi"
	>
		<Bell size={24} class="size-6 text-black" />
		{#if isBellUnread}
			<span
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
				</div>

				<div class="flex items-center gap-3">
					<div class="relative flex-1">
						<input
							type="text"
							bind:value={searchQuery}
							placeholder="Cari..."
							class="w-full rounded-xl border border-border/80 bg-white py-2 pl-9 pr-8 font-sans text-xs text-foreground placeholder:text-muted focus:border-primary-dark focus:outline-none focus:ring-1 focus:ring-primary-dark"
							aria-label="Cari notifikasi"
						/>
						<MagnifyingGlass
							size={16}
							class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
						/>
						{#if searchQuery}
							<button
								type="button"
								onclick={handleClearSearch}
								class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground cursor-pointer"
								aria-label="Hapus pencarian"
							>
								<X size={14} />
							</button>
						{/if}
					</div>

					<a
						href={resolve('/notifications' as '/projects')}
						onclick={handleSeeAll}
						class="shrink-0 font-sans text-xs font-semibold text-primary-dark hover:underline"
					>
						Lihat Semua
					</a>
				</div>

				{#if filteredNotifications.length > 0}
					<div
						class="max-h-[380px] overflow-y-auto space-y-1 pr-1 focus:outline-none"
						role="feed"
						aria-label="Daftar notifikasi"
					>
						{#each filteredNotifications as notification (notification.id)}
							<NotificationItemRow {notification} onClick={handleItemClick} />
						{/each}
					</div>
				{:else}
					<NotificationEmptyState
						message={searchQuery.trim()
							? `Tidak ada notifikasi yang sesuai "${searchQuery}"`
							: 'Tidak ada Notifikasi'}
					/>
				{/if}
			</div>
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>

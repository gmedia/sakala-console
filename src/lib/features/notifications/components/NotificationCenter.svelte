<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Check from 'phosphor-svelte/lib/Check';
	import Pagination from '$lib/components/ui/Pagination.svelte';
	import { getErrorMessage } from '$lib/api/errors';
	import type { Notification } from '$lib/api/resources/notifications';
	import { useMarkAllNotificationsRead, useMarkNotificationRead } from '../mutations';
	import { notificationHref } from '../presentation';
	import { createNotificationsQuery, createUnreadNotificationCountQuery } from '../queries';
	import NotificationEmptyState from './NotificationEmptyState.svelte';
	import NotificationItemRow from './NotificationItemRow.svelte';

	type FilterTab = 'all' | 'unread';

	const pageSize = 8;

	let activeFilter = $state<FilterTab>('all');
	let currentPage = $state(1);

	const notificationsQuery = createNotificationsQuery(() => ({
		page: currentPage,
		perPage: pageSize,
		unreadOnly: activeFilter === 'unread'
	}));
	const unreadCountQuery = createUnreadNotificationCountQuery();
	const markRead = useMarkNotificationRead();
	const markAll = useMarkAllNotificationsRead();

	const notifications = $derived(notificationsQuery.data?.data ?? []);
	const lastPage = $derived(notificationsQuery.data?.meta.last_page ?? 1);
	const unreadCount = $derived(unreadCountQuery.data ?? 0);
	const actionError = $derived(markAll.error ?? markRead.error);

	// Marking rows read can empty the last page of the unread filter.
	$effect(() => {
		if (currentPage > lastPage) currentPage = lastPage;
	});

	function selectFilter(filter: FilterTab) {
		activeFilter = filter;
		currentPage = 1;
	}

	function handleItemClick(notification: Notification) {
		if (notification.read_at === null) markRead.mutate(notification.id);
		const target = notificationHref(notification);
		if (target) goto(resolve(target as '/projects')).catch(() => {});
	}
</script>

{#snippet filterButton(filter: FilterTab, label: string)}
	<Button
		variant={activeFilter === filter ? 'primary' : 'secondary'}
		size="sm"
		aria-pressed={activeFilter === filter}
		onclick={() => selectFilter(filter)}
	>
		{label}
	</Button>
{/snippet}

<div class="max-w-reading space-y-6 pb-12">
	<div class="surface-card space-y-6 p-4 sm:p-6">
		<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
			<div class="flex items-center gap-2">
				{@render filterButton('all', 'Semua')}
				{@render filterButton('unread', 'Belum dibaca')}
			</div>

			<Button
				variant="link"
				onclick={() => markAll.mutate()}
				disabled={unreadCount === 0 || markAll.isPending}
			>
				<Check size={16} class="size-4" />
				<span>Tandai semua telah dibaca</span>
			</Button>
		</div>

		{#if actionError}
			<p class="text-xs text-error-base" role="alert">
				{getErrorMessage(actionError, 'Gagal menandai notifikasi. Coba lagi.')}
			</p>
		{/if}

		{#if notificationsQuery.isPending}
			<p class="py-12 text-center text-sm text-muted" role="status">Memuat notifikasi...</p>
		{:else if notificationsQuery.isError}
			<div class="space-y-3 py-12 text-center" role="alert">
				<p class="text-sm text-error-base">
					{getErrorMessage(notificationsQuery.error, 'Gagal memuat notifikasi.')}
				</p>
				<Button variant="link" onclick={() => notificationsQuery.refetch()}>Coba lagi</Button>
			</div>
		{:else if notifications.length > 0}
			<div class="divide-y divide-border border-t border-b border-border">
				{#each notifications as notification (notification.id)}
					<NotificationItemRow {notification} variant="full" onClick={handleItemClick} />
				{/each}
			</div>

			{#if lastPage > 1}
				<div class="flex justify-end pt-2">
					<Pagination
						{currentPage}
						totalPages={lastPage}
						onPageChange={(next) => (currentPage = next)}
					/>
				</div>
			{/if}
		{:else}
			<div class="border-t border-border py-12">
				{#if activeFilter === 'unread'}
					<NotificationEmptyState
						title="Tidak ada notifikasi yang belum dibaca"
						description="Semua notifikasi sudah kamu baca."
					/>
				{:else}
					<NotificationEmptyState />
				{/if}
			</div>
		{/if}
	</div>
</div>

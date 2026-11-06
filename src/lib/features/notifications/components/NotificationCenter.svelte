<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Check from 'phosphor-svelte/lib/Check';
	import Pagination from '$lib/components/ui/Pagination.svelte';
	import { getErrorMessage } from '$lib/api/errors';
	import type { Notification } from '$lib/api/resources/notifications';
	import { cn } from '$lib/utils/cn';
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
	<button
		type="button"
		aria-pressed={activeFilter === filter}
		onclick={() => selectFilter(filter)}
		class={cn(
			'rounded-xl px-4 py-2 font-sans text-xs md:text-sm font-semibold transition-colors cursor-pointer',
			activeFilter === filter
				? 'bg-primary-dark text-white shadow-xs'
				: 'border border-border/80 bg-white text-muted hover:text-foreground'
		)}
	>
		{label}
	</button>
{/snippet}

<div class="mx-auto max-w-7xl space-y-6 pb-12">
	<div class="rounded-2xl border border-border/70 bg-white p-6 md:p-8 shadow-xs space-y-6">
		<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
			<div class="flex items-center gap-2">
				{@render filterButton('all', 'Semua')}
				{@render filterButton('unread', 'Belum Dibaca')}
			</div>

			<button
				type="button"
				onclick={() => markAll.mutate()}
				disabled={unreadCount === 0 || markAll.isPending}
				class="flex min-h-6 items-center gap-1.5 font-sans text-xs md:text-sm font-semibold text-primary-dark hover:underline disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
			>
				<Check size={16} class="size-4" />
				<span>Tandai semua telah dibaca</span>
			</button>
		</div>

		{#if actionError}
			<p class="font-sans text-xs text-error-base" role="alert">
				{getErrorMessage(actionError, 'Gagal menandai notifikasi. Coba lagi.')}
			</p>
		{/if}

		{#if notificationsQuery.isPending}
			<p class="py-12 text-center font-sans text-sm text-muted" role="status">
				Memuat notifikasi...
			</p>
		{:else if notificationsQuery.isError}
			<div class="space-y-3 py-12 text-center" role="alert">
				<p class="font-sans text-sm text-error-base">
					{getErrorMessage(notificationsQuery.error, 'Gagal memuat notifikasi.')}
				</p>
				<button
					type="button"
					onclick={() => notificationsQuery.refetch()}
					class="font-sans text-sm font-semibold text-primary-dark hover:underline cursor-pointer"
				>
					Coba lagi
				</button>
			</div>
		{:else if notifications.length > 0}
			<div class="divide-y divide-border/60 border-t border-b border-border/60">
				{#each notifications as notification (notification.id)}
					<NotificationItemRow {notification} variant="full" onClick={handleItemClick} />
				{/each}
			</div>

			{#if lastPage > 1}
				<div class="pt-2 flex justify-end">
					<Pagination
						{currentPage}
						totalPages={lastPage}
						onPageChange={(next) => (currentPage = next)}
					/>
				</div>
			{/if}
		{:else}
			<div class="py-12 border-t border-border/60">
				<NotificationEmptyState
					message={activeFilter === 'unread'
						? 'Tidak ada notifikasi yang belum dibaca'
						: 'Tidak Ada Notifikasi'}
				/>
			</div>
		{/if}
	</div>
</div>

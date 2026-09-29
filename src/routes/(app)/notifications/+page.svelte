<script lang="ts">
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import {
		MagnifyingGlass,
		X,
		Check,
		Bell,
		Megaphone,
		Rocket,
		WarningCircle,
		CheckCircle
	} from 'phosphor-svelte';
	import { cn } from '$lib/utils/cn';
	import { notificationStore } from '$lib/features/notifications/store.svelte';
	import type { NotificationItem } from '$lib/features/notifications/types';
	import NotificationEmptyState from '$lib/features/notifications/components/NotificationEmptyState.svelte';
	import Pagination from '$lib/components/ui/Pagination.svelte';

	type FilterTab = 'all' | 'unread';

	const pageSize = 8;

	function getTargetPage(id: string | null): number {
		if (!id) return 1;
		const index = notificationStore.all.findIndex((item) => item.id === id);
		return index !== -1 ? Math.floor(index / pageSize) + 1 : 1;
	}

	let activeFilter = $state<FilterTab>('all');
	let searchQuery = $state('');
	let currentPage = $state(getTargetPage(page.url.searchParams.get('id')));

	let targetId = $derived(page.url.searchParams.get('id'));

	const allItems = $derived(notificationStore.all);

	const filteredItems = $derived.by(() => {
		let result = allItems;

		if (activeFilter === 'unread') {
			result = result.filter((item) => !item.is_read);
		}

		if (searchQuery.trim() !== '') {
			const query = searchQuery.trim().toLowerCase();
			result = result.filter((item) => item.message.toLowerCase().includes(query));
		}

		return result;
	});

	$effect(() => {
		const id = targetId;
		if (id) {
			untrack(() => {
				notificationStore.markAsRead(id);

				let index = filteredItems.findIndex((item) => item.id === id);
				if (index === -1) {
					const inAll = allItems.findIndex((item) => item.id === id);
					if (inAll !== -1) {
						activeFilter = 'all';
						searchQuery = '';
						index = inAll;
					}
				}

				if (index !== -1) {
					currentPage = Math.floor(index / pageSize) + 1;
				}
			});
		}
	});

	const totalPages = $derived(Math.ceil(filteredItems.length / pageSize) || 1);

	$effect(() => {
		if (currentPage > totalPages) {
			currentPage = 1;
		}
	});

	const paginatedItems = $derived.by(() => {
		const startIndex = (currentPage - 1) * pageSize;
		return filteredItems.slice(startIndex, startIndex + pageSize);
	});

	function handleItemClick(item: NotificationItem) {
		notificationStore.markAsRead(item.id);
	}

	function handleMarkAllAsRead() {
		notificationStore.markAllAsRead();
	}

	function getIcon(type?: string) {
		switch (type) {
			case 'welcome':
			case 'info':
				return Megaphone;
			case 'deployment':
				return Rocket;
			case 'alert':
				return WarningCircle;
			case 'success':
				return CheckCircle;
			default:
				return Bell;
		}
	}
</script>

<svelte:head>
	<title>Notifikasi | Sakala Console</title>
</svelte:head>

<div class="mx-auto max-w-7xl space-y-6 pb-12">
	<div class="rounded-2xl border border-border/70 bg-white p-6 md:p-8 shadow-xs space-y-6">
		<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
			<div class="flex flex-wrap items-center gap-3">
				<div class="relative w-full sm:w-64">
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
							onclick={() => (searchQuery = '')}
							class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground cursor-pointer"
							aria-label="Hapus pencarian"
						>
							<X size={14} />
						</button>
					{/if}
				</div>

				<div class="flex items-center gap-2">
					<button
						type="button"
						onclick={() => (activeFilter = 'all')}
						class={cn(
							'rounded-xl px-4 py-2 font-sans text-xs md:text-sm font-semibold transition-colors cursor-pointer',
							activeFilter === 'all'
								? 'bg-primary-dark text-white shadow-xs'
								: 'border border-border/80 bg-white text-muted hover:text-foreground'
						)}
					>
						Semua
					</button>

					<button
						type="button"
						onclick={() => (activeFilter = 'unread')}
						class={cn(
							'rounded-xl px-4 py-2 font-sans text-xs md:text-sm font-semibold transition-colors cursor-pointer',
							activeFilter === 'unread'
								? 'bg-primary-dark text-white shadow-xs'
								: 'border border-border/80 bg-white text-muted hover:text-foreground'
						)}
					>
						Belum Dibaca
					</button>
				</div>
			</div>

			<div class="flex items-center justify-end">
				<button
					type="button"
					onclick={handleMarkAllAsRead}
					disabled={notificationStore.unreadCount === 0}
					class="flex items-center gap-1.5 font-sans text-xs md:text-sm font-semibold text-primary-dark hover:underline disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
				>
					<Check size={16} class="size-4" />
					<span>Tandai semua telah dibaca</span>
				</button>
			</div>
		</div>

		{#if filteredItems.length > 0}
			<div class="divide-y divide-border/60 border-t border-b border-border/60">
				{#each paginatedItems as item (item.id)}
					{@const Icon = getIcon(item.type)}
					{@const isTargeted = targetId === item.id}
					<button
						type="button"
						onclick={() => handleItemClick(item)}
						class={cn(
							'group flex w-full items-start md:items-center gap-3.5 py-4 px-3 text-left transition-colors cursor-pointer rounded-xl',
							isTargeted
								? 'bg-primary-50/60 ring-1 ring-primary-dark/30'
								: 'hover:bg-background-soft focus-visible:bg-background-soft'
						)}
					>
						{#if item.avatar}
							<img
								src={item.avatar}
								alt="Avatar"
								class="size-8 shrink-0 rounded-full object-cover ring-1 ring-border/50"
							/>
						{:else}
							<div
								class="flex size-8 shrink-0 items-center justify-center rounded-full bg-black/5 text-foreground/70 transition-colors group-hover:bg-black/10 group-hover:text-foreground"
							>
								<Icon size={16} class="size-4" />
							</div>
						{/if}

						<div class="flex-1 min-w-0 pr-2">
							<p
								class={cn(
									'font-sans text-xs md:text-sm leading-relaxed text-foreground transition-colors',
									!item.is_read ? 'font-medium' : 'font-normal text-foreground/80'
								)}
							>
								{item.message}
							</p>
						</div>

						<span class="shrink-0 font-sans text-xs text-muted font-normal whitespace-nowrap">
							{item.timestamp}
						</span>
						{#if !item.is_read}
							<span
								data-testid="unread-dot"
								class="inline-block size-2 shrink-0 rounded-full bg-blue-600 ring-1 ring-white"
								aria-label="Belum dibaca"
							></span>
						{:else}
							<span class="inline-block size-2 shrink-0 opacity-0" aria-hidden="true"></span>
						{/if}
					</button>
				{/each}
			</div>

			{#if totalPages > 1}
				<div class="pt-2 flex justify-end">
					<Pagination {currentPage} {totalPages} onPageChange={(page) => (currentPage = page)} />
				</div>
			{/if}
		{:else}
			<div class="py-12 border-t border-border/60">
				<NotificationEmptyState
					message={searchQuery.trim()
						? `Tidak ada notifikasi yang sesuai "${searchQuery}"`
						: activeFilter === 'unread'
							? 'Tidak ada notifikasi yang belum dibaca'
							: 'Tidak ada Notifikasi'}
				/>
			</div>
		{/if}
	</div>
</div>

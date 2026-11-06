<script lang="ts">
	import { pageTitle } from '$lib/utils/page-title';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { cn } from '$lib/utils/cn';
	import AccountSettingsTab from '$lib/features/settings/components/AccountSettingsTab.svelte';
	import NotificationSettingsTab from '$lib/features/settings/components/NotificationSettingsTab.svelte';

	const activeTab = $derived(
		page.url.searchParams.get('tab') === 'notifications' ? 'notifications' : 'account'
	);

	function setTab(tab: 'account' | 'notifications') {
		const targetUrl = new URL(page.url);
		targetUrl.searchParams.set('tab', tab);
		goto(resolve((targetUrl.pathname + targetUrl.search) as '/settings'), {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
	}
</script>

<svelte:head>
	<title>{pageTitle('Pengaturan')}</title>
</svelte:head>

<div class="max-w-reading space-y-8 pb-12">
	<p class="text-sm text-muted">Kelola email, kata sandi, dan notifikasi akunmu.</p>

	<div class="grid grid-cols-1 gap-8 md:grid-cols-12">
		<div class="md:col-span-3 space-y-1">
			<button
				type="button"
				onclick={() => setTab('account')}
				class={cn(
					'flex w-full items-center gap-2.5 rounded-control px-4 py-3 text-sm font-semibold transition-colors cursor-pointer text-left',
					activeTab === 'account'
						? 'bg-primary-50 text-primary-dark font-semibold'
						: 'text-muted hover:bg-background-soft hover:text-foreground'
				)}
			>
				<span>Akun dan keamanan</span>
			</button>

			<button
				type="button"
				onclick={() => setTab('notifications')}
				class={cn(
					'flex w-full items-center gap-2.5 rounded-control px-4 py-3 text-sm font-semibold transition-colors cursor-pointer text-left',
					activeTab === 'notifications'
						? 'bg-primary-50 text-primary-dark font-semibold'
						: 'text-muted hover:bg-background-soft hover:text-foreground'
				)}
			>
				<span>Notifikasi</span>
			</button>
		</div>

		<div class="md:col-span-9">
			{#if activeTab === 'account'}
				<AccountSettingsTab />
			{:else if activeTab === 'notifications'}
				<NotificationSettingsTab />
			{/if}
		</div>
	</div>
</div>

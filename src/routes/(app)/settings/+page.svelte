<script lang="ts">
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
	<title>Pengaturan | Sakala Console</title>
</svelte:head>

<div class="mx-auto max-w-4xl space-y-8 pb-12">
	<div>
		<h2 class="font-sans text-2xl font-bold text-foreground">Pengaturan</h2>
		<p class="mt-1 font-sans text-sm text-muted">
			Kelola profil, keamanan, notifikasi, dan akses API akunmu.
		</p>
	</div>

	<div class="grid grid-cols-1 gap-8 md:grid-cols-12">
		<div class="md:col-span-3 space-y-1">
			<button
				type="button"
				onclick={() => setTab('account')}
				class={cn(
					'flex w-full items-center gap-2.5 rounded-xl px-4 py-3 font-sans text-sm font-semibold transition-colors cursor-pointer text-left',
					activeTab === 'account'
						? 'bg-primary-50 text-primary-dark font-semibold'
						: 'text-muted hover:bg-background-soft hover:text-foreground'
				)}
			>
				<span>Akun & Keamanan</span>
			</button>

			<button
				type="button"
				onclick={() => setTab('notifications')}
				class={cn(
					'flex w-full items-center gap-2.5 rounded-xl px-4 py-3 font-sans text-sm font-semibold transition-colors cursor-pointer text-left',
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

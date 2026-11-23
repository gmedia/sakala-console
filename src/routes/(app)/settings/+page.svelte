<script lang="ts">
	import { pageTitle } from '$lib/utils/page-title';
	import { page } from '$app/state';
	import { cn } from '$lib/utils/cn';
	import ProfilePanel from '$lib/features/profile/components/ProfilePanel.svelte';
	import AccountSettingsTab from '$lib/features/settings/components/AccountSettingsTab.svelte';
	import NotificationSettingsTab from '$lib/features/settings/components/NotificationSettingsTab.svelte';
	import { SETTINGS_TABS, settingsHref, settingsTabFrom } from '$lib/features/settings/tabs';

	const activeTab = $derived(settingsTabFrom(page.url.searchParams.get('tab')));
</script>

<svelte:head>
	<title>{pageTitle('Pengaturan')}</title>
</svelte:head>

<div class="max-w-reading space-y-8 pb-12">
	<p class="text-sm text-muted">Kelola profil, email, kata sandi, dan notifikasi akunmu.</p>

	<div class="grid grid-cols-1 gap-8 md:grid-cols-12">
		<!-- Links, so a tab can be bookmarked or opened from elsewhere (`/profile` opens Profil). -->
		<nav aria-label="Bagian pengaturan akun" class="space-y-1 md:col-span-3">
			{#each SETTINGS_TABS as tab (tab.id)}
				<!-- eslint-disable svelte/no-navigation-without-resolve -- resolved, plus a query -->
				<a
					href={settingsHref(tab.id)}
					aria-current={activeTab === tab.id ? 'page' : undefined}
					data-sveltekit-replacestate
					data-sveltekit-noscroll
					data-sveltekit-keepfocus
					class={cn(
						'flex w-full items-center gap-2.5 rounded-control px-4 py-3 text-left text-sm font-semibold transition-colors',
						activeTab === tab.id
							? 'bg-primary-50 text-primary-dark'
							: 'text-muted hover:bg-background-soft hover:text-foreground'
					)}
				>
					{tab.label}
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{/each}
		</nav>

		<div class="md:col-span-9">
			{#if activeTab === 'profile'}
				<ProfilePanel />
			{:else if activeTab === 'account'}
				<AccountSettingsTab />
			{:else}
				<NotificationSettingsTab />
			{/if}
		</div>
	</div>
</div>

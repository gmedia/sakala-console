<script lang="ts">
	import { pageTitle } from '$lib/utils/page-title';
	import { page } from '$app/state';
	import FormPageLayout from '$lib/components/layout/templates/FormPageLayout.svelte';
	import { sectionNavLinkClass } from '$lib/components/layout/section-nav';
	import PanelHelp from '$lib/components/panel/PanelHelp.svelte';
	import ProfilePanel from '$lib/features/profile/components/ProfilePanel.svelte';
	import AccountSettingsTab from '$lib/features/settings/components/AccountSettingsTab.svelte';
	import DeleteAccountSection from '$lib/features/settings/components/DeleteAccountSection.svelte';
	import NotificationSettingsTab from '$lib/features/settings/components/NotificationSettingsTab.svelte';
	import { ACCOUNT_HELP_LINKS, ACCOUNT_PANEL_COPY } from '$lib/features/settings/panel';
	import { SETTINGS_TABS, settingsHref, settingsTabFrom } from '$lib/features/settings/tabs';

	const activeTab = $derived(settingsTabFrom(page.url.searchParams.get('tab')));
</script>

<svelte:head>
	<title>{pageTitle('Pengaturan')}</title>
</svelte:head>

{#snippet panel()}
	<PanelHelp links={ACCOUNT_HELP_LINKS} testid="account-help" />
{/snippet}

{#snippet danger()}
	<DeleteAccountSection />
{/snippet}

<div class="flex flex-col gap-4">
	<!-- Links, so a tab can be bookmarked or opened from elsewhere (`/profile` opens Profil). Each
	     switch is its own history entry, so Back returns to the tab before instead of leaving. -->
	<nav aria-label={ACCOUNT_PANEL_COPY.nav} data-testid="account-settings-sections">
		<ul class="flex flex-wrap gap-1">
			{#each SETTINGS_TABS as tab (tab.id)}
				<li>
					<!-- eslint-disable svelte/no-navigation-without-resolve -- resolved, plus a query -->
					<a
						href={settingsHref(tab.id)}
						aria-current={activeTab === tab.id ? 'page' : undefined}
						data-sveltekit-noscroll
						data-sveltekit-keepfocus
						class={sectionNavLinkClass(activeTab === tab.id)}
					>
						{tab.label}
					</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				</li>
			{/each}
		</ul>
	</nav>

	<!-- The form template: the tab's cards left, the account's documents right, deleting the
	     account last on the tab it belongs to. -->
	<FormPageLayout
		panelLabel={ACCOUNT_PANEL_COPY.label}
		{panel}
		after={activeTab === 'account' ? danger : undefined}
	>
		{#if activeTab === 'profile'}
			<ProfilePanel />
		{:else if activeTab === 'account'}
			<AccountSettingsTab />
		{:else}
			<NotificationSettingsTab />
		{/if}
	</FormPageLayout>
</div>

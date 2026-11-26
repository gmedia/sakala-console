<script lang="ts">
	// Links are resolveRoute() output from overview/links.ts.
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { sectionNavLinkClass } from '$lib/components/layout/section-nav';
	import { settingsPageHref } from '../../overview/links';
	import type { SettingsPage, SettingsSection } from '../../settings-anchors';
	import { SETTINGS_PANEL_COPY as COPY } from '../../settings-panel';

	type Props = {
		projectId: string;
		sections: readonly SettingsSection[];
		current: SettingsPage;
		/** Form pages holding changes not saved yet; marked so they are not forgotten. */
		unsaved: ReadonlySet<string>;
	};

	let { projectId, sections, current, unsaved }: Props = $props();
</script>

<!-- Wraps instead of scrolling: at 320 px every page stays visible, two or three rows of short links. -->
<nav aria-label={COPY.nav} data-testid="settings-sections">
	<ul class="flex flex-wrap gap-1">
		{#each sections as section (section.page)}
			{@const active = section.page === current}
			<li>
				<a
					href={settingsPageHref(projectId, section.page)}
					aria-current={active ? 'page' : undefined}
					aria-label={unsaved.has(section.page) ? `${section.label}, ${COPY.unsaved}` : undefined}
					class={sectionNavLinkClass(active)}
				>
					{section.label}
					{#if unsaved.has(section.page)}
						<span class="size-1.5 shrink-0 rounded-full bg-warning" aria-hidden="true"></span>
					{/if}
				</a>
			</li>
		{/each}
	</ul>
</nav>

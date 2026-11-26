<script lang="ts">
	import { page } from '$app/state';
	import ProjectSettingsPage from '$lib/features/projects/components/settings/ProjectSettingsPage.svelte';
	import { SETTINGS_PAGES } from '$lib/features/projects/settings-anchors';

	const projectId = $derived(page.params.id as string);
</script>

<ProjectSettingsPage {projectId} page={SETTINGS_PAGES.build} />

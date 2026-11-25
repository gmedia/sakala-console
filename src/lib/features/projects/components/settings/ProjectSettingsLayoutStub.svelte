<script lang="ts">
	import { initProjectDetailContext } from '$lib/features/projects/detail/projectDetailState.svelte';
	import type { SettingsPage } from '$lib/features/projects/settings-anchors';
	import ProjectSettingsPage from './ProjectSettingsPage.svelte';

	let { projectId, page }: { projectId: string; page: SettingsPage } = $props();

	// What the project layout provides around the settings: one draft for every page.
	initProjectDetailContext();
</script>

<ProjectSettingsPage {projectId} {page} />

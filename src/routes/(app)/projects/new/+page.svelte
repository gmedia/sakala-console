<script lang="ts">
	import { pageTitle } from '$lib/utils/page-title';
	import CreateProjectWizard from '$lib/features/projects/components/create/CreateProjectWizard.svelte';
</script>

<svelte:head>
	<title>{pageTitle('Proyek baru')}</title>
</svelte:head>

<CreateProjectWizard />

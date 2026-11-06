<script lang="ts">
	import { pageTitle } from '$lib/utils/page-title';
	import GithubCallback from '$lib/features/auth/components/GithubCallback.svelte';
</script>

<svelte:head>
	<title>{pageTitle('Masuk dengan GitHub')}</title>
</svelte:head>

<GithubCallback />

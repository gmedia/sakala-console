<script lang="ts">
	import { pageTitle } from '$lib/utils/page-title';
	import FeedbackForm from '$lib/features/feedback/components/FeedbackForm.svelte';
</script>

<svelte:head>
	<title>{pageTitle('Kirim masukan')}</title>
</svelte:head>

<FeedbackForm />

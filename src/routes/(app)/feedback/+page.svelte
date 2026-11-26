<script lang="ts">
	import { pageTitle } from '$lib/utils/page-title';
	import FocusedPageLayout from '$lib/components/layout/templates/FocusedPageLayout.svelte';
	import FeedbackForm from '$lib/features/feedback/components/FeedbackForm.svelte';
</script>

<svelte:head>
	<title>{pageTitle('Kirim masukan')}</title>
</svelte:head>

<!-- One form, one button: the focused template, centred. -->
<FocusedPageLayout>
	<FeedbackForm />
</FocusedPageLayout>

<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import { pageTitle } from '$lib/utils/page-title';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import AuthStatusScreen from '$lib/features/auth/components/AuthStatusScreen.svelte';
	import {
		EMAIL_CHANGED_CONTENT,
		parseEmailLinkStatus
	} from '$lib/features/auth/email-link-status';

	const status = $derived(parseEmailLinkStatus(page.url.searchParams.get('status')));

	const content = $derived(EMAIL_CHANGED_CONTENT[status]);
</script>

<svelte:head>
	<title>{pageTitle(content.title)}</title>
</svelte:head>

<AuthStatusScreen {...content}>
	<Button href={resolve('/settings')} size="lg" class="w-full">Buka pengaturan</Button>
</AuthStatusScreen>

<script lang="ts">
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
	<title>{content.title} | Sakala Console</title>
</svelte:head>

<AuthStatusScreen {...content}>
	<a
		href={resolve('/settings')}
		class="flex w-full items-center justify-center rounded-lg bg-primary-600 px-4 py-3 text-center font-semibold text-white shadow-sm transition-all hover:bg-primary-700"
	>
		Buka Pengaturan
	</a>
</AuthStatusScreen>

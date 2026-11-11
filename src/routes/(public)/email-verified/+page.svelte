<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import { pageTitle } from '$lib/utils/page-title';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import AuthStatusScreen from '$lib/features/auth/components/AuthStatusScreen.svelte';
	import ResendVerification from '$lib/features/auth/components/ResendVerification.svelte';
	import EmailDeliveryNotice from '$lib/features/auth/components/EmailDeliveryNotice.svelte';
	import {
		resolveAuthAvailability,
		verificationUnavailableMessage
	} from '$lib/features/auth/availability';
	import { useAuthOptions } from '$lib/features/auth/queries';
	import {
		EMAIL_VERIFIED_CONTENT,
		parseEmailLinkStatus
	} from '$lib/features/auth/email-link-status';

	const status = $derived(parseEmailLinkStatus(page.url.searchParams.get('status')));

	const authOptions = useAuthOptions();
	const availability = $derived(resolveAuthAvailability(authOptions));
	const showDeliveryNotice = $derived(status === 'error' && availability.emailDeliveryOff);

	const content = $derived(
		showDeliveryNotice
			? {
					...EMAIL_VERIFIED_CONTENT.error,
					description: 'Tautan ini salah atau sudah kedaluwarsa, jadi emailmu belum terverifikasi.'
				}
			: EMAIL_VERIFIED_CONTENT[status]
	);
</script>

<svelte:head>
	<title>{pageTitle(content.title)}</title>
</svelte:head>

<AuthStatusScreen {...content}>
	{#if showDeliveryNotice}
		<EmailDeliveryNotice message={verificationUnavailableMessage(availability)} />
	{:else if status === 'error'}
		<ResendVerification />
	{/if}
	<Button href={resolve('/login')} size="lg" class="w-full">Masuk</Button>
</AuthStatusScreen>

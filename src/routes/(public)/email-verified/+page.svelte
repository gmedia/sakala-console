<script lang="ts">
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
	<title>{content.title} | Sakala Console</title>
</svelte:head>

<AuthStatusScreen {...content}>
	{#if showDeliveryNotice}
		<EmailDeliveryNotice message={verificationUnavailableMessage(availability)} />
	{:else if status === 'error'}
		<ResendVerification />
	{/if}
	<a
		href={resolve('/login')}
		class="flex w-full items-center justify-center rounded-lg bg-primary-600 px-4 py-3 text-center font-semibold text-white shadow-sm transition-all hover:bg-primary-700"
	>
		Masuk
	</a>
</AuthStatusScreen>

<script lang="ts">
	import { pageTitle } from '$lib/utils/page-title';
	import AuthSplitLayout from '$lib/features/auth/components/AuthSplitLayout.svelte';
	import ForgotPasswordForm from '$lib/features/auth/components/ForgotPasswordForm.svelte';
	import { resolveAuthAvailability } from '$lib/features/auth/availability';
	import { useAuthOptions } from '$lib/features/auth/queries';

	const authOptions = useAuthOptions();
	const availability = $derived(resolveAuthAvailability(authOptions));
	const description = $derived(
		availability.isLoading
			? 'Memeriksa pilihan yang tersedia.'
			: availability.emailDeliveryOff
				? 'Tautan untuk membuat kata sandi baru dikirim lewat email.'
				: 'Masukkan email akunmu. Kami kirim tautan untuk membuat kata sandi baru.'
	);
</script>

<svelte:head>
	<title>{pageTitle('Lupa kata sandi')}</title>
</svelte:head>

<AuthSplitLayout title="Lupa kata sandi" {description}>
	<ForgotPasswordForm />
</AuthSplitLayout>

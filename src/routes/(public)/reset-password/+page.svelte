<script lang="ts">
	import { pageTitle } from '$lib/utils/page-title';
	import AuthSplitLayout from '$lib/features/auth/components/AuthSplitLayout.svelte';
	import ResetPasswordForm from '$lib/features/auth/components/ResetPasswordForm.svelte';
</script>

<svelte:head>
	<title>{pageTitle('Buat kata sandi baru')}</title>
	<!-- The token is in the address until the form reads it; never send it as a referrer. -->
	<meta name="referrer" content="no-referrer" />
</svelte:head>

<AuthSplitLayout
	title="Buat kata sandi baru"
	description="Setelah tersimpan, kata sandi lama berhenti berlaku dan kamu bisa langsung masuk."
>
	<ResetPasswordForm />
</AuthSplitLayout>

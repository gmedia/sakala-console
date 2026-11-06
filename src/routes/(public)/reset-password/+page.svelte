<script lang="ts">
	import AuthSplitLayout from '$lib/features/auth/components/AuthSplitLayout.svelte';
	import ResetPasswordForm from '$lib/features/auth/components/ResetPasswordForm.svelte';
</script>

<svelte:head>
	<title>Buat Kata Sandi Baru | Sakala Console</title>
	<!-- The token is in the address until the form reads it; never send it as a referrer. -->
	<meta name="referrer" content="no-referrer" />
</svelte:head>

<AuthSplitLayout
	title="Buat Kata Sandi Baru"
	description="Setelah tersimpan, kata sandi lama berhenti berlaku dan kamu bisa langsung masuk."
>
	<ResetPasswordForm />
</AuthSplitLayout>

<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import { tick } from 'svelte';
	import { resolve } from '$app/paths';
	import FormField from '$lib/components/ui/FormField.svelte';
	import { getErrorMessage, getFieldError } from '$lib/api/errors';
	import { passwordResetUnavailableMessage, resolveAuthAvailability } from '../availability';
	import { useForgotPassword } from '../mutations';
	import { useAuthOptions } from '../queries';
	import AuthOptionsSkeleton from './AuthOptionsSkeleton.svelte';
	import EmailDeliveryNotice from './EmailDeliveryNotice.svelte';

	const forgotPassword = useForgotPassword();
	const authOptions = useAuthOptions();
	const availability = $derived(resolveAuthAvailability(authOptions));

	let email = $state('');
	let fieldError = $state<string | null>(null);
	let generalError = $state<string | null>(null);
	let sentTo = $state<string | null>(null);

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (forgotPassword.isPending) return;
		const target = email.trim();
		fieldError = null;
		generalError = null;

		if (!target.includes('@')) {
			fieldError = target
				? 'Tulis alamat email lengkap, misalnya nama@contoh.com.'
				: 'Isi email akunmu dulu.';
			await tick();
			document.getElementById('email')?.focus();
			return;
		}

		try {
			await forgotPassword.mutateAsync(target);
			sentTo = target;
		} catch (error) {
			fieldError = getFieldError(error, 'email') ?? null;
			generalError = fieldError
				? null
				: getErrorMessage(error, 'Gagal mengirim permintaan. Coba lagi.');
			if (fieldError) {
				await tick();
				document.getElementById('email')?.focus();
			}
		}
	}
</script>

<div class="space-y-6">
	{#if availability.isLoading}
		<AuthOptionsSkeleton />
	{:else if availability.emailDeliveryOff}
		<EmailDeliveryNotice message={passwordResetUnavailableMessage(availability)} />
	{:else if sentTo}
		<div class="space-y-2 rounded-control border border-primary/20 bg-primary-50 p-6" role="status">
			<p class="font-semibold text-primary">Cek email kamu</p>
			<p class="text-sm text-foreground">
				Kalau <strong class="font-semibold text-foreground">{sentTo}</strong> terdaftar di Sakala, tautan
				untuk membuat kata sandi baru sudah kami kirim ke sana. Tautan berlaku 60 menit. Cek juga folder
				spam.
			</p>
		</div>
	{:else}
		<form class="space-y-4" onsubmit={handleSubmit} novalidate>
			{#if generalError}
				<div
					class="rounded-control border border-error/30 bg-error-50 p-3 text-sm font-medium text-error"
					role="alert"
				>
					{generalError}
				</div>
			{/if}
			<FormField
				id="email"
				label="Email"
				type="email"
				autocomplete="email"
				placeholder="nama@contoh.com"
				bind:value={email}
				error={fieldError}
			/>
			<Button size="lg" class="w-full" type="submit" disabled={forgotPassword.isPending}>
				{forgotPassword.isPending ? 'Mengirim...' : 'Kirim tautan reset'}
			</Button>
		</form>
	{/if}

	<p class="text-center text-sm text-muted">
		Ingat kata sandimu?
		<a href={resolve('/login')} class="ml-1 font-semibold text-primary-dark hover:underline"
			>Masuk</a
		>
	</p>
</div>

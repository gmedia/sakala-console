<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import FormField from '$lib/components/ui/FormField.svelte';
	import { ApiError, getErrorMessage, getFieldError } from '$lib/api/errors';
	import { resolveAuthAvailability } from '../availability';
	import { useResendVerification } from '../mutations';
	import { useAuthOptions } from '../queries';
	import { useCooldown } from '../use-cooldown.svelte';

	/** A short pause after a successful send, so a second click does not burn the API's limit. */
	const AFTER_SEND_COOLDOWN_SECONDS = 30;
	const FALLBACK_RATE_LIMIT_SECONDS = 60;

	type Props = {
		/** Known from the login or register form. Without it, the user types their address. */
		email?: string;
	};

	let { email }: Props = $props();

	const resend = useResendVerification();
	const authOptions = useAuthOptions();
	const availability = $derived(resolveAuthAvailability(authOptions));
	const cooldown = useCooldown();

	let typedEmail = $state('');
	let sentTo = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);
	let emailFieldError = $state<string | null>(null);

	const target = $derived((email ?? typedEmail).trim());
	const isDisabled = $derived(!target || resend.isPending || cooldown.remaining > 0);

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (isDisabled) return;
		sentTo = null;
		errorMessage = null;
		emailFieldError = null;

		try {
			await resend.mutateAsync(target);
			sentTo = target;
			cooldown.start(AFTER_SEND_COOLDOWN_SECONDS);
		} catch (error) {
			if (error instanceof ApiError && error.isRateLimited) {
				cooldown.start(error.retryAfterSeconds ?? FALLBACK_RATE_LIMIT_SECONDS);
			}
			emailFieldError = email ? null : (getFieldError(error, 'email') ?? null);
			errorMessage = emailFieldError
				? null
				: getErrorMessage(error, 'Gagal mengirim ulang email. Coba lagi.');
		}
	}
</script>

{#if availability.emailActionsAvailable}
	<form class="space-y-3" onsubmit={handleSubmit} novalidate>
		{#if email === undefined}
			<FormField
				id="resend-email"
				label="Email akunmu"
				type="email"
				autocomplete="email"
				placeholder="nama@contoh.com"
				bind:value={typedEmail}
				error={emailFieldError}
			/>
		{/if}

		<Button variant="secondary" size="lg" class="w-full" type="submit" disabled={isDisabled}>
			{#if resend.isPending}
				Mengirim...
			{:else if cooldown.remaining > 0}
				Kirim ulang dalam {cooldown.remaining} detik
			{:else}
				Kirim ulang email verifikasi
			{/if}
		</Button>

		{#if sentTo}
			<p class="text-xs text-muted" role="status">
				Kalau {sentTo} terdaftar dan belum terverifikasi, tautan baru sudah kami kirim. Cek kotak masuk
				dan folder spam.
			</p>
		{/if}
		{#if errorMessage}
			<p class="text-xs text-error" role="alert">{errorMessage}</p>
		{/if}
	</form>
{/if}

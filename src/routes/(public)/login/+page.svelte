<script lang="ts">
	import { pageTitle } from '$lib/utils/page-title';
	import Button from '$lib/components/ui/Button.svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { onMount, tick } from 'svelte';
	import {
		redirectToGithubAuth,
		redirectToGoogleAuth,
		getLastLoginProvider,
		isValidInternalPath,
		clearPendingOAuthProvider,
		type AuthProviderId
	} from '$lib/features/auth/utils/oauth';
	import { resolve } from '$app/paths';
	import FormField from '$lib/components/ui/FormField.svelte';
	import AuthSplitLayout from '$lib/features/auth/components/AuthSplitLayout.svelte';
	import AuthProviderButtons from '$lib/features/auth/components/AuthProviderButtons.svelte';
	import AuthDivider from '$lib/features/auth/components/AuthDivider.svelte';
	import LastUsedBadge from '$lib/features/auth/components/LastUsedBadge.svelte';
	import ResendVerification from '$lib/features/auth/components/ResendVerification.svelte';
	import AuthOptionsSkeleton from '$lib/features/auth/components/AuthOptionsSkeleton.svelte';
	import {
		LOGIN_PASSWORD_RESET_UNAVAILABLE,
		loginMethodLayout,
		resolveAuthAvailability,
		type OAuthProviderId
	} from '$lib/features/auth/availability';
	import { useAuthOptions } from '$lib/features/auth/queries';
	import { useLogin } from '$lib/features/auth/mutations';
	import {
		consumeAccountDeletedNotice,
		consumeSessionEndedNotice
	} from '$lib/features/auth/session-notice';
	import { ApiError, NetworkError } from '$lib/api/errors';

	/** Older links ask for the email form with `?method=email`; it is always here now, so it gets focus. */
	const EMAIL_METHOD_PARAM = 'email';

	let email = $state('');
	let password = $state('');
	let lastProvider = $state<AuthProviderId | null>(null);
	let errors = $state({
		email: '',
		password: '',
		general: ''
	});

	/** Set only after the API confirmed the password, so it reveals nothing about the email. */
	let unverifiedEmail = $state<string | null>(null);
	let generalErrorRef = $state<HTMLElement | null>(null);

	const loginMutation = useLogin();
	const sessionEnded = consumeSessionEndedNotice();
	const accountDeleted = consumeAccountDeletedNotice();

	const authOptions = useAuthOptions();
	const availability = $derived(resolveAuthAvailability(authOptions));
	const methods = $derived(loginMethodLayout(availability, lastProvider));

	onMount(() => {
		lastProvider = getLastLoginProvider();
		if (page.url.searchParams.get('method') === EMAIL_METHOD_PARAM) {
			document.getElementById('email')?.focus();
		}
	});

	$effect(() => {
		const errorParam = page.url.searchParams.get('error');
		if (errorParam) {
			clearPendingOAuthProvider();
			localStorage.removeItem('return_url');
			switch (errorParam) {
				case 'google_access_denied':
					errors.general = 'Kamu membatalkan izin masuk dengan Google.';
					break;
				case 'google_email_conflict':
					errors.general = 'Email Google kamu sudah terdaftar dengan metode login lain.';
					break;
				case 'google_email_unavailable':
					errors.general = 'Email publik tidak ditemukan di akun Google kamu.';
					break;
				case 'google_invalid_state':
					errors.general = 'Sesi login tidak valid. Silakan coba lagi.';
					break;
				case 'google_provider_failure':
					errors.general = 'Gagal terhubung dengan Google. Silakan coba beberapa saat lagi.';
					break;
				case 'github_access_denied':
					errors.general = 'Kamu membatalkan izin masuk dengan GitHub.';
					break;
				case 'github_email_conflict':
					errors.general = 'Email GitHub kamu sudah terdaftar dengan metode login lain.';
					break;
				case 'github_email_unavailable':
					errors.general = 'Email publik tidak ditemukan di akun GitHub kamu.';
					break;
				case 'github_invalid_state':
					errors.general = 'Sesi login tidak valid. Silakan coba lagi.';
					break;
				case 'github_provider_failure':
					errors.general = 'Gagal terhubung dengan GitHub. Silakan coba beberapa saat lagi.';
					break;
				default:
					errors.general = 'Terjadi kesalahan saat autentikasi. Silakan coba lagi.';
			}
		}
	});

	function handleProviderClick(id: OAuthProviderId) {
		const returnTo = page.url.searchParams.get('returnTo');

		if (id === 'github') redirectToGithubAuth(returnTo);
		else redirectToGoogleAuth(returnTo);
	}

	function handleEmailInput() {
		if (errors.email) {
			if (!email.trim()) {
				errors.email = 'Kamu belum memasukkan email.';
			} else if (!email.includes('@')) {
				errors.email = 'Format email tidak valid.';
			} else {
				errors.email = '';
			}
		}
	}

	function handlePasswordInput() {
		if (errors.password) {
			if (!password) {
				errors.password = 'Kamu belum memasukkan kata sandi.';
			} else {
				errors.password = '';
			}
		}
	}

	function validateLogin() {
		let isValid = true;
		errors = { email: '', password: '', general: '' };
		unverifiedEmail = null;

		if (!email.trim()) {
			errors.email = 'Kamu belum memasukkan email.';
			isValid = false;
		} else if (!email.includes('@')) {
			errors.email = 'Format email tidak valid.';
			isValid = false;
		}
		if (!password) {
			errors.password = 'Kamu belum memasukkan kata sandi.';
			isValid = false;
		}
		return isValid;
	}

	async function focusFirstError() {
		await tick();
		if (errors.email) document.getElementById('email')?.focus();
		else if (errors.password) document.getElementById('password')?.focus();
		else generalErrorRef?.focus();
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!validateLogin()) {
			await focusFirstError();
			return;
		}

		try {
			await loginMutation.mutateAsync({
				email: email.trim(),
				password
			});

			const returnTo = page.url.searchParams.get('returnTo');
			if (isValidInternalPath(returnTo)) {
				goto(resolve(returnTo as '/projects'));
			} else {
				goto(resolve('/projects'));
			}
		} catch (err) {
			if (err instanceof ApiError && err.status === 401) {
				errors.general = 'Email atau kata sandi salah.';
			} else if (err instanceof ApiError && err.code === 'email_not_verified') {
				errors.general = err.message;
				unverifiedEmail = email.trim();
			} else if (err instanceof ApiError && err.isValidationError) {
				errors.email = err.errors.email?.[0] ?? '';
				errors.password = err.errors.password?.[0] ?? '';
				if (!errors.email && !errors.password) errors.general = err.message;
			} else if (err instanceof ApiError) {
				errors.general = err.message || 'Gagal masuk. Silakan periksa kembali data kamu.';
			} else if (err instanceof NetworkError) {
				errors.general = 'Tidak dapat terhubung ke server. Periksa koneksi internet kamu.';
			} else {
				errors.general = 'Terjadi kesalahan saat masuk. Silakan coba lagi.';
			}
			await focusFirstError();
		}
	}
</script>

<svelte:head>
	<title>{pageTitle('Masuk')}</title>
</svelte:head>

{#snippet providerButtons()}
	{#if availability.isLoading}
		<AuthOptionsSkeleton />
	{:else}
		<AuthProviderButtons
			providers={methods.providers}
			verb="Masuk"
			lastUsed={methods.lastUsed}
			onSelect={handleProviderClick}
		/>
	{/if}
{/snippet}

{#snippet emailForm()}
	<form class="space-y-4" onsubmit={handleSubmit} novalidate>
		{#if methods.emailFirst}
			<div class="flex flex-wrap items-center justify-between gap-2">
				<p class="text-sm font-medium text-foreground">Masuk dengan email</p>
				<LastUsedBadge />
			</div>
		{/if}
		{#if unverifiedEmail}
			<ResendVerification email={unverifiedEmail} />
		{/if}
		<FormField
			id="email"
			label="Email"
			type="email"
			autocomplete="email"
			placeholder="nama@contoh.com"
			required
			bind:value={email}
			oninput={handleEmailInput}
			error={errors.email}
		/>

		<FormField
			id="password"
			label="Kata sandi"
			type="password"
			autocomplete="current-password"
			placeholder="Kata sandi"
			required
			bind:value={password}
			oninput={handlePasswordInput}
			error={errors.password}
		/>

		{#if availability.emailActionsAvailable}
			<a
				href={resolve('/forgot-password')}
				class="inline-flex min-h-6 items-center text-sm font-semibold text-primary-dark hover:underline"
			>
				Lupa kata sandi?
			</a>
		{:else if availability.emailDeliveryOff}
			<!-- Where the reset link would be: the only part of logging in that needs email. -->
			<p class="text-xs text-foreground/70" data-testid="password-reset-unavailable">
				{LOGIN_PASSWORD_RESET_UNAVAILABLE}
			</p>
		{/if}

		<Button type="submit" size="lg" disabled={loginMutation.isPending} class="w-full">
			{#if loginMutation.isPending}
				<span class="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
				></span>
				<span>Memproses...</span>
			{:else}
				<span>Masuk</span>
			{/if}
		</Button>
	</form>
{/snippet}

<AuthSplitLayout title="Selamat datang" description="Masuk ke dashboard kamu untuk melanjutkan.">
	<div class="space-y-6">
		{#if accountDeleted}
			<p
				class="rounded-control border border-primary/30 bg-primary-50 p-3 text-sm font-medium text-foreground"
				role="status"
			>
				Akunmu sudah dihapus. Terima kasih sudah mencoba Sakala.
			</p>
		{/if}

		{#if sessionEnded}
			<p
				class="rounded-control border border-primary/30 bg-primary-50 p-3 text-sm font-medium text-foreground"
				role="status"
			>
				Sesi kamu berakhir, silakan masuk lagi.
			</p>
		{/if}

		{#if errors.general}
			<div
				bind:this={generalErrorRef}
				class="rounded-control border border-error/30 bg-error-50 p-3 text-sm font-medium text-error focus:outline-none"
				role="alert"
				tabindex="-1"
			>
				{errors.general}
			</div>
		{/if}

		<!-- Every method at once, the one used last on this browser first, so switching costs no click.
		     The password form does not wait for the API; only the provider list does. -->
		{#if !availability.isLoading && methods.providers.length === 0}
			{@render emailForm()}
		{:else if methods.emailFirst}
			{@render emailForm()}
			<AuthDivider label="atau masuk dengan" />
			{@render providerButtons()}
		{:else}
			{@render providerButtons()}
			<AuthDivider label="atau masuk dengan email" />
			{@render emailForm()}
		{/if}

		<p class="text-center text-sm text-muted">
			Belum punya akun?
			<a
				href={resolve('/register')}
				class="ml-1 inline-flex min-h-6 items-center font-semibold text-primary-dark hover:underline"
			>
				Daftar
			</a>
		</p>
	</div>
</AuthSplitLayout>

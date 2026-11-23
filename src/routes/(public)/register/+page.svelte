<script lang="ts">
	import { pageTitle } from '$lib/utils/page-title';
	import Button from '$lib/components/ui/Button.svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { tick } from 'svelte';
	import { redirectToGithubAuth, redirectToGoogleAuth } from '$lib/features/auth/utils/oauth';
	import FormField from '$lib/components/ui/FormField.svelte';
	import AuthSplitLayout from '$lib/features/auth/components/AuthSplitLayout.svelte';
	import AuthProviderButtons from '$lib/features/auth/components/AuthProviderButtons.svelte';
	import AuthDivider from '$lib/features/auth/components/AuthDivider.svelte';
	import ResendVerification from '$lib/features/auth/components/ResendVerification.svelte';
	import AuthOptionsSkeleton from '$lib/features/auth/components/AuthOptionsSkeleton.svelte';
	import EmailDeliveryNotice from '$lib/features/auth/components/EmailDeliveryNotice.svelte';
	import LegalConsentField from '$lib/features/auth/components/LegalConsentField.svelte';
	import LegalLink from '$lib/features/auth/components/LegalLink.svelte';
	import {
		CONSENT_REQUIRED_MESSAGE,
		isOutdatedLegalVersion,
		LEGAL_VERSIONS_UNAVAILABLE_MESSAGE,
		legalConsentError
	} from '$lib/features/auth/legal-consent';
	import { LEGAL_LINKS } from '$lib/config/project';
	import { queryKeys } from '$lib/api/query-keys';
	import { useQueryClient } from '@tanstack/svelte-query';
	import {
		oauthProviders,
		registerOffersEmail,
		registrationUnavailableMessage,
		resolveAuthAvailability,
		type OAuthProviderId
	} from '$lib/features/auth/availability';
	import { useAuthOptions } from '$lib/features/auth/queries';
	import { useRegister } from '$lib/features/auth/mutations';
	import { ApiError } from '$lib/api/errors';

	const client = useQueryClient();
	const authOptions = useAuthOptions();
	const legal = $derived(authOptions.data?.legal);
	const availability = $derived(resolveAuthAvailability(authOptions));
	const authProviders = $derived(oauthProviders(availability));
	const offersEmail = $derived(registerOffersEmail(availability));

	/** Older links ask for the email form with `?method=email`; it is always here now, so it gets focus. */
	const EMAIL_METHOD_PARAM = 'email';
	const focusEmailOnLoad = page.url.searchParams.get('method') === EMAIL_METHOD_PARAM;
	let emailFocused = false;
	$effect(() => {
		if (!focusEmailOnLoad || emailFocused || availability.isLoading || !offersEmail) return;
		emailFocused = true;
		void tick().then(() => document.getElementById('email')?.focus());
	});

	let email = $state('');
	let name = $state('');
	let password = $state('');
	let confirmPass = $state('');
	let acceptedTerms = $state(false);
	let isRegistered = $state(false);
	let errors = $state({
		email: '',
		name: '',
		password: '',
		confirmPass: '',
		consent: '',
		general: ''
	});

	const registerMutation = useRegister();

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

	function handleNameInput() {
		if (errors.name) {
			if (!name.trim()) {
				errors.name = 'Kamu belum memasukkan nama lengkap.';
			} else {
				errors.name = '';
			}
		}
	}

	function handlePasswordInput() {
		if (errors.password) {
			if (!password) {
				errors.password = 'Kamu belum membuat kata sandi.';
			} else if (password.length < 8) {
				errors.password = 'Kata sandi minimal 8 karakter.';
			} else {
				errors.password = '';
			}
		}
		if (errors.confirmPass && confirmPass) {
			if (confirmPass === password) {
				errors.confirmPass = '';
			} else {
				errors.confirmPass = 'Konfirmasi kata sandi tidak cocok.';
			}
		}
	}

	function handleConfirmPassInput() {
		if (errors.confirmPass) {
			if (!confirmPass) {
				errors.confirmPass = 'Kamu belum mengonfirmasi kata sandi.';
			} else if (confirmPass !== password) {
				errors.confirmPass = 'Konfirmasi kata sandi tidak cocok.';
			} else {
				errors.confirmPass = '';
			}
		}
	}

	function validateRegister() {
		let isValid = true;
		errors = {
			email: '',
			name: '',
			password: '',
			confirmPass: '',
			consent: '',
			general: ''
		};

		if (!email.trim()) {
			errors.email = 'Kamu belum memasukkan email.';
			isValid = false;
		} else if (!email.includes('@')) {
			errors.email = 'Format email tidak valid.';
			isValid = false;
		}

		if (!name.trim()) {
			errors.name = 'Kamu belum memasukkan nama lengkap.';
			isValid = false;
		}

		if (!password) {
			errors.password = 'Kamu belum membuat kata sandi.';
			isValid = false;
		} else if (password.length < 8) {
			errors.password = 'Kata sandi minimal 8 karakter.';
			isValid = false;
		}

		if (!confirmPass) {
			errors.confirmPass = 'Kamu belum mengonfirmasi kata sandi.';
			isValid = false;
		} else if (confirmPass !== password) {
			errors.confirmPass = 'Konfirmasi kata sandi tidak cocok.';
			isValid = false;
		}

		if (!acceptedTerms) {
			errors.consent = CONSENT_REQUIRED_MESSAGE;
			isValid = false;
		}

		return isValid;
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!validateRegister() || !legal) return;

		try {
			await registerMutation.mutateAsync({
				name: name.trim(),
				email: email.trim(),
				password,
				password_confirmation: confirmPass,
				accept_terms: true,
				terms_version: legal.terms_version,
				acceptable_use_version: legal.acceptable_use_version
			});
			isRegistered = true;
		} catch (err) {
			if (err instanceof ApiError && err.isValidationError) {
				if (err.errors.name?.[0]) errors.name = err.errors.name[0];
				if (err.errors.email?.[0]) errors.email = err.errors.email[0];
				if (err.errors.password?.[0]) errors.password = err.errors.password[0];
				if (err.errors.password_confirmation?.[0]) {
					errors.confirmPass = err.errors.password_confirmation[0];
				}
				errors.consent = legalConsentError(err) ?? '';
				if (isOutdatedLegalVersion(err)) {
					acceptedTerms = false;
					void client.invalidateQueries({ queryKey: queryKeys.auth.options });
				}
			} else if (err instanceof ApiError) {
				errors.general = err.message;
			} else if (err instanceof Error) {
				errors.general = err.message;
			} else {
				errors.general = 'Terjadi kesalahan saat mendaftar. Silakan coba lagi.';
			}
		}
	}
</script>

<svelte:head>
	<title>{pageTitle('Daftar')}</title>
</svelte:head>

<!-- The consent field or the line under the buttons links the privacy notice, so the footer does not. -->
<AuthSplitLayout
	title="Daftar"
	description="Dari repository ke URL publik."
	mode="register"
	privacyLinkInBody={!availability.isLoading && !isRegistered}
>
	<div class="space-y-6">
		{#if availability.emailDeliveryOff}
			<EmailDeliveryNotice message={registrationUnavailableMessage(availability)} />
		{/if}

		{#if availability.isLoading}
			<AuthOptionsSkeleton />
		{:else if isRegistered}
			<div class="space-y-3 rounded-card border border-primary/20 bg-primary-50 p-6 text-center">
				<div class="text-base font-semibold text-primary-dark">Cek email kamu</div>
				<p class="text-sm text-foreground" role="status">
					Langkah berikutnya kami kirim ke
					<strong class="font-semibold wrap-anywhere">{email}</strong>. Cek juga folder spam kalau
					belum terlihat.
				</p>
				<ResendVerification email={email.trim()} />
				<div class="pt-2">
					<Button href={resolve('/login')}>Kembali ke halaman masuk</Button>
				</div>
			</div>
		{:else}
			<!-- Every way to register at once; the email form needs no extra click. -->
			{#if authProviders.length > 0}
				<AuthProviderButtons
					providers={authProviders}
					verb="Daftar"
					onSelect={handleProviderClick}
				/>
			{/if}
			{#if offersEmail && authProviders.length > 0}
				<AuthDivider label="atau daftar dengan email" />
			{/if}
		{/if}

		{#if !availability.isLoading && !isRegistered && offersEmail}
			<form class="space-y-4" onsubmit={handleSubmit} novalidate>
				{#if errors.general}
					<div
						class="rounded-control border border-error/30 bg-error-50 p-3 text-sm font-medium text-error"
					>
						{errors.general}
					</div>
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
					id="name"
					label="Nama lengkap"
					autocomplete="name"
					placeholder="Rani Wulandari"
					required
					bind:value={name}
					oninput={handleNameInput}
					error={errors.name}
				/>

				<FormField
					id="password"
					label="Kata sandi"
					type="password"
					autocomplete="new-password"
					placeholder="Kata sandi"
					hint="Minimal 8 karakter."
					required
					bind:value={password}
					oninput={handlePasswordInput}
					error={errors.password}
				/>

				<FormField
					id="confirmPass"
					label="Konfirmasi kata sandi"
					type="password"
					autocomplete="new-password"
					placeholder="Ulangi kata sandi"
					required
					bind:value={confirmPass}
					oninput={handleConfirmPassInput}
					error={errors.confirmPass}
				/>

				{#if legal}
					<LegalConsentField
						id="accept-terms"
						bind:checked={acceptedTerms}
						error={errors.consent}
						onchange={() => (errors.consent = '')}
					/>
				{:else}
					<div class="space-y-3" role="alert">
						<p class="text-sm text-foreground">{LEGAL_VERSIONS_UNAVAILABLE_MESSAGE}</p>
						<Button
							variant="secondary"
							disabled={authOptions.isFetching}
							onclick={() => authOptions.refetch()}
						>
							{authOptions.isFetching ? 'Memuat...' : 'Coba lagi'}
						</Button>
					</div>
				{/if}

				<Button
					type="submit"
					size="lg"
					disabled={registerMutation.isPending || !legal}
					class="w-full"
				>
					{#if registerMutation.isPending}
						<span
							class="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
						></span>
						<span>Membuat akun...</span>
					{:else}
						<span>Buat akun</span>
					{/if}
				</Button>
			</form>
		{/if}

		<p class="text-center text-sm text-muted">
			Sudah punya akun?
			<a
				href={resolve('/login')}
				class="ml-1 inline-flex min-h-6 items-center font-semibold text-primary-dark hover:underline"
			>
				Masuk
			</a>
		</p>

		<!-- The consent field carries the privacy link; without it, this is where the notice is read. -->
		{#if !availability.isLoading && !isRegistered && !(offersEmail && legal)}
			<p class="text-center text-sm text-muted">
				Baca <LegalLink href={LEGAL_LINKS.privacy}>Pemberitahuan Privasi</LegalLink> untuk tahu bagaimana
				datamu diproses. Syarat Layanan kamu setujui setelah masuk.
			</p>
		{/if}
	</div>
</AuthSplitLayout>

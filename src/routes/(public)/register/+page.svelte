<script lang="ts">
	import { pageTitle } from '$lib/utils/page-title';
	import Button from '$lib/components/ui/Button.svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		redirectToGithubAuth,
		redirectToGoogleAuth,
		type AuthProviderId
	} from '$lib/features/auth/utils/oauth';
	import FormField from '$lib/components/ui/FormField.svelte';
	import AuthSplitLayout from '$lib/features/auth/components/AuthSplitLayout.svelte';
	import SocialLogo from '$lib/features/auth/components/SocialLogo.svelte';
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
		registerProviders,
		registrationUnavailableMessage,
		resolveAuthAvailability
	} from '$lib/features/auth/availability';
	import { useAuthOptions } from '$lib/features/auth/queries';
	import { useRegister } from '$lib/features/auth/mutations';
	import { ApiError } from '$lib/api/errors';

	const client = useQueryClient();
	const authOptions = useAuthOptions();
	const legal = $derived(authOptions.data?.legal);
	const availability = $derived(resolveAuthAvailability(authOptions));
	const authProviders = $derived(registerProviders(availability));

	/** `?method=email` is a link anyone can keep, so the form still needs delivery to be on. */
	let authMethod = $derived(
		page.url.searchParams.get('method') === 'email' && !availability.emailDeliveryOff
			? 'email'
			: 'choice'
	);

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

	function handleProviderClick(id: AuthProviderId) {
		const returnTo = page.url.searchParams.get('returnTo');

		if (id === 'email') {
			const query = returnTo
				? `?method=email&returnTo=${encodeURIComponent(returnTo)}`
				: '?method=email';
			goto(resolve(`/register${query}` as '/register'), { keepFocus: true });
		} else if (id === 'github') {
			redirectToGithubAuth(returnTo);
		} else if (id === 'google') {
			redirectToGoogleAuth(returnTo);
		}
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

<AuthSplitLayout
	title={authMethod === 'email' && !availability.isLoading ? 'Daftar dengan email' : 'Daftar'}
	description="Dari repository ke URL publik."
	mode="register"
>
	<div class="space-y-6">
		{#if availability.emailDeliveryOff}
			<EmailDeliveryNotice message={registrationUnavailableMessage(availability)} />
		{/if}

		{#if availability.isLoading}
			<AuthOptionsSkeleton />
		{:else if authMethod === 'choice'}
			<div class="space-y-3">
				{#each authProviders as provider (provider.id ?? provider)}
					<Button
						variant="secondary"
						size="lg"
						class="w-full"
						onclick={() => handleProviderClick(provider.id)}
					>
						<SocialLogo name={provider.id} />
						<span>Daftar dengan {provider.name}</span>
					</Button>
				{/each}
			</div>
		{:else if isRegistered}
			<div class="space-y-3 rounded-card border border-primary/20 bg-primary-50 p-6 text-center">
				<div class="text-base font-semibold text-primary-dark">Cek email kamu</div>
				<p class="text-sm text-foreground" role="status">
					Langkah berikutnya kami kirim ke
					<strong class="wrap-anywhere font-semibold">{email}</strong>. Cek juga folder spam kalau
					belum terlihat.
				</p>
				<ResendVerification email={email.trim()} />
				<div class="pt-2">
					<Button href={resolve('/login')}>Kembali ke halaman masuk</Button>
				</div>
			</div>
		{:else}
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

		{#if authMethod === 'choice' && !availability.isLoading}
			<p class="text-center text-sm text-muted">
				Baca <LegalLink href={LEGAL_LINKS.privacy}>Pemberitahuan Privasi</LegalLink> untuk tahu bagaimana
				datamu diproses. Syarat Layanan kamu setujui setelah masuk.
			</p>
		{/if}
	</div>
</AuthSplitLayout>

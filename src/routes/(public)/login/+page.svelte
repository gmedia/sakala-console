<script lang="ts">
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
	import AuthBranding from '$lib/features/auth/components/AuthBranding.svelte';
	import SocialLogo from '$lib/features/auth/components/SocialLogo.svelte';
	import ResendVerification from '$lib/features/auth/components/ResendVerification.svelte';
	import AuthOptionsSkeleton from '$lib/features/auth/components/AuthOptionsSkeleton.svelte';
	import EmailDeliveryNotice from '$lib/features/auth/components/EmailDeliveryNotice.svelte';
	import {
		loginProviders,
		loginUnavailableMessage,
		resolveAuthAvailability
	} from '$lib/features/auth/availability';
	import { useAuthOptions } from '$lib/features/auth/queries';
	import Eye from 'phosphor-svelte/lib/Eye';
	import EyeSlash from 'phosphor-svelte/lib/EyeSlash';
	import { useLogin } from '$lib/features/auth/mutations';
	import { consumeSessionEndedNotice } from '$lib/features/auth/session-notice';
	import { ApiError, NetworkError } from '$lib/api/errors';

	let authMethod = $derived(page.url.searchParams.get('method') === 'email' ? 'email' : 'choice');

	let email = $state('');
	let password = $state('');
	let showPassword = $state(false);
	let lastProvider = $state<AuthProviderId | null>(null);
	let showAllProviders = $state(false);
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

	const authOptions = useAuthOptions();
	const availability = $derived(resolveAuthAvailability(authOptions));
	const authProviders = $derived(loginProviders(availability));
	/** A provider remembered on this browser may no longer be configured. */
	const offeredLastProvider = $derived(
		authProviders.some((provider) => provider.id === lastProvider) ? lastProvider : null
	);

	function providerName(id: AuthProviderId): string {
		switch (id) {
			case 'github':
				return 'Github';
			case 'google':
				return 'Google';
			case 'email':
				return 'Email';
		}
	}

	onMount(() => {
		lastProvider = getLastLoginProvider();
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

	function handleProviderClick(id: AuthProviderId) {
		const returnTo = page.url.searchParams.get('returnTo');

		if (id === 'email') {
			const query = returnTo
				? `?method=email&returnTo=${encodeURIComponent(returnTo)}`
				: '?method=email';

			goto(resolve(`/login${query}` as '/login'), { keepFocus: true });
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
	<title>Masuk | Sakala Console</title>
</svelte:head>

<main
	id="main-content"
	tabindex="-1"
	class="min-h-screen grid grid-cols-1 lg:grid-cols-10 outline-none"
>
	<div class="flex flex-col justify-center items-center bg-white p-8 sm:p-12 lg:p-16 lg:col-span-4">
		<div class="w-full max-w-lg space-y-8">
			<div class="space-y-2">
				<h1 class="text-4xl font-semibold text-zinc-950 tracking-tight">Selamat Datang</h1>
				<p class="text-sm text-muted font-normal">Masuk ke dashboard kamu untuk melanjutkan.</p>
			</div>

			<div class="space-y-6">
				{#if sessionEnded}
					<p
						class="rounded-lg border border-primary/30 bg-primary-50 p-3 text-sm font-medium text-foreground"
						role="status"
					>
						Sesi kamu berakhir, silakan masuk lagi.
					</p>
				{/if}

				{#if availability.emailDeliveryOff}
					<EmailDeliveryNotice message={loginUnavailableMessage(availability)} />
				{/if}

				{#if authMethod === 'choice'}
					{#if errors.general}
						<div
							class="p-3 text-xs font-medium text-error bg-error-50 border border-error/30 rounded-lg"
							role="alert"
						>
							{errors.general}
						</div>
					{/if}

					{#if availability.isLoading}
						<AuthOptionsSkeleton />
					{:else if offeredLastProvider && !showAllProviders}
						<div class="space-y-4">
							<button
								onclick={() => handleProviderClick(offeredLastProvider)}
								type="button"
								class="w-full bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 font-semibold py-3 px-4 rounded-lg flex items-center justify-between transition-all duration-200 hover:shadow-sm cursor-pointer"
							>
								<div class="flex items-center gap-2.5">
									<SocialLogo name={offeredLastProvider} />
									<span>Masuk akun dengan {providerName(offeredLastProvider)}</span>
								</div>
								<span
									class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-50 text-primary border border-primary/30"
								>
									Terakhir Digunakan &rarr;
								</span>
							</button>

							<div class="relative flex items-center justify-center my-4">
								<div class="w-full border-t border-zinc-200"></div>
								<span
									class="absolute bg-white px-3 text-xs text-muted font-medium uppercase tracking-wider"
									>Atau</span
								>
							</div>

							<button
								onclick={() => (showAllProviders = true)}
								type="button"
								class="w-full bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-700 font-medium py-3 px-4 rounded-lg flex items-center justify-center transition-all duration-200 hover:shadow-sm cursor-pointer text-sm"
							>
								Masuk dengan profil lainnya
							</button>
						</div>
					{:else}
						<div class="space-y-4">
							{#each authProviders as provider (provider.id)}
								<button
									onclick={() => handleProviderClick(provider.id)}
									type="button"
									class="w-full bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2.5 transition-all duration-200 hover:shadow-sm cursor-pointer"
								>
									<SocialLogo name={provider.id} />
									<span>Masuk akun dengan {provider.name}</span>
								</button>
							{/each}
						</div>
					{/if}
				{:else}
					<form class="space-y-4" onsubmit={handleSubmit} novalidate>
						{#if errors.general}
							<div
								bind:this={generalErrorRef}
								class="p-3 text-xs font-medium text-error bg-error-50 border border-error/30 rounded-lg focus:outline-none"
								role="alert"
								tabindex="-1"
							>
								{errors.general}
							</div>
						{/if}
						{#if unverifiedEmail}
							<ResendVerification email={unverifiedEmail} />
						{/if}
						<div class="space-y-1.5 flex flex-col">
							<label for="email" class="text-sm font-semibold text-zinc-700">Email</label>
							<input
								id="email"
								type="email"
								placeholder="example@gmail.com"
								bind:value={email}
								oninput={handleEmailInput}
								aria-invalid={errors.email ? 'true' : undefined}
								aria-describedby={errors.email ? 'email-error' : undefined}
								class="w-full rounded-lg border border-primary bg-white px-4 py-3 text-sm font-medium placeholder-muted focus:border-primary-600 focus:ring-1 focus:ring-primary-600 focus:outline-none transition-colors {errors.email
									? 'border-error bg-error-50/20 text-error placeholder-error focus:border-error'
									: 'border-primary bg-white text-zinc-800 placeholder-muted focus:border-primary-600'}"
								required
							/>
							{#if errors.email}
								<p id="email-error" class="text-xs text-error mt-1">{errors.email}</p>
							{/if}
						</div>

						<div class="space-y-1.5 flex flex-col">
							<div class="flex justify-between items-center w-full">
								<label for="password" class="text-sm font-semibold text-zinc-700">Kata Sandi</label>
							</div>
							<div class="relative flex items-center">
								<input
									id="password"
									type={showPassword ? 'text' : 'password'}
									placeholder="Masukkan kata sandi kamu"
									bind:value={password}
									oninput={handlePasswordInput}
									aria-invalid={errors.password ? 'true' : undefined}
									aria-describedby={errors.password ? 'password-error' : undefined}
									class="w-full rounded-lg border border-primary bg-white pl-4 pr-11 py-3 text-sm font-medium placeholder-muted focus:border-primary-600 focus:ring-1 focus:ring-primary-600 focus:outline-none transition-colors
                  {errors.password
										? 'border-error bg-error-50/20 text-error placeholder-error focus:border-error'
										: 'border-primary bg-white text-zinc-800 placeholder-muted focus:border-primary-600'}"
									required
								/>
								<button
									type="button"
									onclick={() => (showPassword = !showPassword)}
									class="absolute right-3.5 text-primary hover:text-primary-600 p-1 cursor-pointer"
									aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
								>
									{#if showPassword}
										<EyeSlash size={20} />
									{:else}
										<Eye size={20} />
									{/if}
								</button>
							</div>
							{#if errors.password}
								<p id="password-error" class="text-xs text-error mt-1">{errors.password}</p>
							{/if}
						</div>

						{#if availability.emailActionsAvailable}
							<a
								href={resolve('/forgot-password')}
								class="inline-flex min-h-6 items-center text-xs font-semibold text-primary-600 hover:underline"
							>
								Lupa Kata Sandi?
							</a>
						{/if}

						<Button
							type="submit"
							disabled={loginMutation.isPending}
							class="mt-2 w-full gap-2.5 rounded-lg px-4 py-3 text-base"
						>
							{#if loginMutation.isPending}
								<div
									class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"
								></div>
								<span>Memproses...</span>
							{:else}
								<span>Lanjutkan dengan Email</span>
							{/if}
						</Button>
					</form>
				{/if}

				<p class="text-center text-sm text-muted">
					Belum Punya Akun?
					<a
						href={resolve('/register')}
						class="text-primary-600 font-semibold hover:underline ml-1"
					>
						Daftar
					</a>
				</p>
			</div>
		</div>
	</div>
	<AuthBranding mode="login" />
</main>

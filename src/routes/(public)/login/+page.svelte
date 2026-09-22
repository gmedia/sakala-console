<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
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
	import { Eye, EyeSlash } from 'phosphor-svelte';
	import { useLogin } from '$lib/features/auth/mutations';
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

	const loginMutation = useLogin();

	const authProviders: { id: AuthProviderId; name: string }[] = [
		{ id: 'github', name: 'Github' },
		{ id: 'google', name: 'Google' },
		{ id: 'email', name: 'Email' }
	];

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
					errors.general = 'Anda membatalkan izin masuk dengan Google.';
					break;
				case 'google_email_conflict':
					errors.general = 'Email Google Anda sudah terdaftar dengan metode login lain.';
					break;
				case 'google_email_unavailable':
					errors.general = 'Email publik tidak ditemukan di akun Google Anda.';
					break;
				case 'google_invalid_state':
					errors.general = 'Sesi login tidak valid. Silakan coba lagi.';
					break;
				case 'google_provider_failure':
					errors.general = 'Gagal terhubung dengan Google. Silakan coba beberapa saat lagi.';
					break;
				case 'github_access_denied':
					errors.general = 'Anda membatalkan izin masuk dengan GitHub.';
					break;
				case 'github_email_conflict':
					errors.general = 'Email GitHub Anda sudah terdaftar dengan metode login lain.';
					break;
				case 'github_email_unavailable':
					errors.general = 'Email publik tidak ditemukan di akun GitHub Anda.';
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
				errors.email = 'Anda belum memasukan Email';
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
				errors.password = 'Anda belum memasukan Kata Sandi';
			} else {
				errors.password = '';
			}
		}
	}

	function validateLogin() {
		let isValid = true;
		errors = { email: '', password: '', general: '' };

		if (!email.trim()) {
			errors.email = 'Anda belum memasukan Email';
			isValid = false;
		} else if (!email.includes('@')) {
			errors.email = 'Format email tidak valid.';
			isValid = false;
		}
		if (!password) {
			errors.password = 'Anda belum memasukan Kata Sandi';
			isValid = false;
		}
		return isValid;
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!validateLogin()) return;

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
			if (err instanceof ApiError) {
				if (err.status === 401 || err.status === 422) {
					errors.general = 'Email atau kata sandi salah.';
				} else {
					errors.general = err.message || 'Gagal masuk. Silakan periksa kembali data Anda.';
				}
			} else if (err instanceof NetworkError) {
				errors.general = 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.';
			} else {
				errors.general = 'Terjadi kesalahan saat masuk. Silakan coba lagi.';
			}
		}
	}
</script>

<svelte:head>
	<title>Masuk | Sakala Console</title>
</svelte:head>

<main class="min-h-screen grid grid-cols-1 lg:grid-cols-10">
	<div class="flex flex-col justify-center items-center bg-white p-8 sm:p-12 lg:p-16 lg:col-span-4">
		<div class="w-full max-w-lg space-y-8">
			<div class="space-y-2">
				<h2 class="text-4xl font-semibold text-zinc-950 tracking-tight">Selamat Datang</h2>
				<p class="text-sm text-zinc-500 font-normal">Masuk ke dashboard Anda untuk melanjutkan.</p>
			</div>

			<div class="space-y-6">
				{#if authMethod === 'choice'}
					{#if errors.general}
						<div
							class="p-3 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg"
						>
							{errors.general}
						</div>
					{/if}

					{#if lastProvider && !showAllProviders}
						<div class="space-y-4">
							<button
								onclick={() => handleProviderClick(lastProvider!)}
								type="button"
								class="w-full bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 font-semibold py-3 px-4 rounded-lg flex items-center justify-between transition-all duration-200 hover:shadow-sm cursor-pointer"
							>
								<div class="flex items-center gap-2.5">
									<SocialLogo name={lastProvider} />
									<span>Masuk akun dengan {providerName(lastProvider)}</span>
								</div>
								<span
									class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-50 text-[#0F766E] border border-teal-200/80"
								>
									Terakhir Digunakan &rarr;
								</span>
							</button>

							<div class="relative flex items-center justify-center my-4">
								<div class="w-full border-t border-zinc-200"></div>
								<span
									class="absolute bg-white px-3 text-xs text-zinc-400 font-medium uppercase tracking-wider"
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
								class="p-3 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg"
							>
								{errors.general}
							</div>
						{/if}
						<div class="space-y-1.5 flex flex-col">
							<label for="email" class="text-sm font-semibold text-zinc-700">Email</label>
							<input
								id="email"
								type="email"
								placeholder="example@gmail.com"
								bind:value={email}
								oninput={handleEmailInput}
								class="w-full rounded-lg border border-[#0F766E] bg-white px-4 py-3 text-sm font-medium placeholder-zinc-400 focus:border-[#0e6b64] focus:ring-1 focus:ring-[#0e6b64] focus:outline-none transition-colors {errors.email
									? 'border-red-400 bg-red-50/20 text-red-500 placeholder-red-300 focus:border-red-500'
									: 'border-[#0F766E] bg-white text-zinc-800 placeholder-zinc-400 focus:border-[#0e6b64]'}"
								required
							/>
							{#if errors.email}
								<p class="text-xs text-red-500 mt-1">{errors.email}</p>
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
									placeholder="Masukkan Kata Sandi Anda"
									bind:value={password}
									oninput={handlePasswordInput}
									class="w-full rounded-lg border border-[#0F766E] bg-white pl-4 pr-11 py-3 text-sm font-medium placeholder-zinc-400 focus:border-[#0e6b64] focus:ring-1 focus:ring-[#0e6b64] focus:outline-none transition-colors
                  {errors.password
										? 'border-red-400 bg-red-50/20 text-red-500 placeholder-red-300 focus:border-red-500'
										: 'border-[#0F766E] bg-white text-zinc-800 placeholder-zinc-400 focus:border-[#0e6b64]'}"
									required
								/>
								<button
									type="button"
									onclick={() => (showPassword = !showPassword)}
									class="absolute right-3.5 text-[#0F766E] hover:text-[#0e6b64] p-1 cursor-pointer"
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
								<p class="text-xs text-red-500 mt-1">{errors.password}</p>
							{/if}
						</div>

						<a href={resolve('/')} class="text-xs font-semibold text-[#0e6b64] hover:underline">
							Lupa Kata Sandi?
						</a>

						<button
							type="submit"
							disabled={loginMutation.isPending}
							class="w-full bg-[#0F766E] hover:bg-[#0e6b64] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2.5 transition-all duration-200 hover:shadow-sm cursor-pointer mt-2"
						>
							{#if loginMutation.isPending}
								<div
									class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"
								></div>
								<span>Memproses...</span>
							{:else}
								<span>Lanjutkan dengan Email</span>
							{/if}
						</button>
					</form>
				{/if}

				<p class="text-center text-sm text-zinc-500">
					Belum Punya Akun?
					<a href={resolve('/register')} class="text-[#0e6b64] font-semibold hover:underline ml-1">
						Daftar
					</a>
				</p>
			</div>
		</div>
	</div>
	<AuthBranding mode="login" />
</main>

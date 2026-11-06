<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		redirectToGithubAuth,
		redirectToGoogleAuth,
		type AuthProviderId
	} from '$lib/features/auth/utils/oauth';
	import AuthBranding from '$lib/features/auth/components/AuthBranding.svelte';
	import SocialLogo from '$lib/features/auth/components/SocialLogo.svelte';
	import ResendVerification from '$lib/features/auth/components/ResendVerification.svelte';
	import AuthOptionsSkeleton from '$lib/features/auth/components/AuthOptionsSkeleton.svelte';
	import EmailDeliveryNotice from '$lib/features/auth/components/EmailDeliveryNotice.svelte';
	import {
		registerProviders,
		registrationUnavailableMessage,
		resolveAuthAvailability
	} from '$lib/features/auth/availability';
	import { useAuthOptions } from '$lib/features/auth/queries';
	import Eye from 'phosphor-svelte/lib/Eye';
	import EyeSlash from 'phosphor-svelte/lib/EyeSlash';
	import { useRegister } from '$lib/features/auth/mutations';
	import { ApiError } from '$lib/api/errors';

	const authOptions = useAuthOptions();
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
	let showPassword = $state(false);
	let showConfirmPass = $state(false);
	let isRegistered = $state(false);
	let errors = $state({
		email: '',
		name: '',
		password: '',
		confirmPass: '',
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

		return isValid;
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!validateRegister()) return;

		try {
			await registerMutation.mutateAsync({
				name: name.trim(),
				email: email.trim(),
				password,
				password_confirmation: confirmPass
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
	<title>Daftar | Sakala Console</title>
</svelte:head>

<main
	id="main-content"
	tabindex="-1"
	class="min-h-screen grid grid-cols-1 lg:grid-cols-10 outline-none"
>
	<div class="flex flex-col justify-center items-center bg-white p-8 sm:p-12 lg:p-16 lg:col-span-4">
		<div class="w-full max-w-lg space-y-8">
			<div class="space-y-2">
				<h1 class="text-4xl font-semibold text-zinc-950 tracking-tight">
					{authMethod === 'email' && !availability.isLoading ? 'Daftar Dengan Email' : 'Daftar'}
				</h1>
				<p class="text-sm text-muted font-normal">Buat akun pengembang kamu hari ini.</p>
			</div>

			<div class="space-y-6">
				{#if availability.emailDeliveryOff}
					<EmailDeliveryNotice message={registrationUnavailableMessage(availability)} />
				{/if}

				{#if availability.isLoading}
					<AuthOptionsSkeleton />
				{:else if authMethod === 'choice'}
					{#each authProviders as provider (provider.id ?? provider)}
						<button
							onclick={() => handleProviderClick(provider.id)}
							type="button"
							class="w-full bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2.5 transition-all duration-200 hover:shadow-sm cursor-pointer"
						>
							<SocialLogo name={provider.id} />
							<span>Buat akun dengan {provider.name}</span>
						</button>
					{/each}
				{:else if isRegistered}
					<div class="rounded-lg bg-primary-50 border border-primary/20 p-6 text-center space-y-3">
						<div class="text-primary font-semibold text-lg">Cek email kamu</div>
						<p class="text-sm text-zinc-600" role="status">
							Langkah berikutnya kami kirim ke
							<strong class="text-zinc-900 wrap-anywhere">{email}</strong>. Cek juga folder spam
							kalau belum terlihat.
						</p>
						<ResendVerification email={email.trim()} />
						<div class="pt-2">
							<a
								href={resolve('/login')}
								class="inline-block px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-600 transition-colors"
							>
								Kembali ke Halaman Masuk
							</a>
						</div>
					</div>
				{:else}
					<form class="space-y-4" onsubmit={handleSubmit} novalidate>
						{#if errors.general}
							<div
								class="p-3 text-xs font-medium text-error bg-error-50 border border-error/30 rounded-lg"
							>
								{errors.general}
							</div>
						{/if}

						<div class="space-y-1.5 flex flex-col">
							<label for="email" class="text-sm font-semibold text-zinc-700">Email</label>
							<input
								id="email"
								type="email"
								placeholder="Masukkan alamat email kamu"
								bind:value={email}
								oninput={handleEmailInput}
								class="w-full rounded-lg border border-primary bg-white px-4 py-3 text-sm font-medium placeholder-muted focus:border-primary-600 focus:ring-1 focus:ring-primary-600 focus:outline-none transition-colors {errors.email
									? 'border-error bg-error-50/20 text-error placeholder-error focus:border-error'
									: 'border-primary bg-white text-zinc-800 placeholder-muted focus:border-primary-600'}"
								required
							/>
							{#if errors.email}
								<p class="text-xs text-error font-normal">{errors.email}</p>
							{/if}
						</div>

						<div class="space-y-1.5 flex flex-col">
							<label for="name" class="text-sm font-semibold text-zinc-700">Nama Lengkap</label>
							<input
								id="name"
								type="text"
								placeholder="Masukkan nama lengkap kamu"
								bind:value={name}
								oninput={handleNameInput}
								class="w-full rounded-lg border border-primary bg-white px-4 py-3 text-sm font-medium placeholder-muted focus:border-primary-600 focus:ring-1 focus:ring-primary-600 focus:outline-none transition-colors {errors.name
									? 'border-error bg-error-50/20 text-error placeholder-error focus:border-error'
									: 'border-primary bg-white text-zinc-800 placeholder-muted focus:border-primary-600'}"
								required
							/>
							{#if errors.name}
								<p class="text-xs text-error font-normal">{errors.name}</p>
							{/if}
						</div>

						<div class="space-y-1.5 flex flex-col">
							<label for="password" class="text-sm font-semibold text-zinc-700">Kata Sandi</label>
							<div class="relative flex items-center">
								<input
									id="password"
									type={showPassword ? 'text' : 'password'}
									placeholder="Buat kata sandi kamu"
									bind:value={password}
									oninput={handlePasswordInput}
									class="w-full rounded-lg border border-primary bg-white pl-4 pr-11 py-3 text-sm font-medium placeholder-muted focus:border-primary-600 focus:ring-1 focus:ring-primary-600 focus:outline-none transition-colors {errors.password
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
							<p class="text-xs font-normal {errors.password ? 'text-error' : 'text-primary-600'}">
								{errors.password || 'Minimal 8 karakter.'}
							</p>
						</div>

						<div class="space-y-1.5 flex flex-col">
							<label for="confirmPass" class="text-sm font-semibold text-zinc-700"
								>Konfirmasi Kata Sandi</label
							>
							<div class="relative flex items-center">
								<input
									id="confirmPass"
									type={showConfirmPass ? 'text' : 'password'}
									placeholder="Masukkan ulang kata sandi kamu"
									bind:value={confirmPass}
									oninput={handleConfirmPassInput}
									class="w-full rounded-lg border border-primary bg-white pl-4 pr-11 py-3 text-sm font-medium placeholder-muted focus:border-primary-600 focus:ring-1 focus:ring-primary-600 focus:outline-none transition-colors {errors.confirmPass
										? 'border-error bg-error-50/20 text-error placeholder-error focus:border-error'
										: 'border-primary bg-white text-zinc-800 placeholder-muted focus:border-primary-600'}"
									required
								/>
								<button
									type="button"
									onclick={() => (showConfirmPass = !showConfirmPass)}
									class="absolute right-3.5 text-primary hover:text-primary-600 p-1 cursor-pointer"
									aria-label={showConfirmPass
										? 'Sembunyikan konfirmasi kata sandi'
										: 'Tampilkan konfirmasi kata sandi'}
								>
									{#if showConfirmPass}
										<EyeSlash size={20} />
									{:else}
										<Eye size={20} />
									{/if}
								</button>
							</div>
							{#if errors.confirmPass}
								<p class="text-xs font-normal text-error">{errors.confirmPass}</p>
							{/if}
						</div>

						<Button
							type="submit"
							disabled={registerMutation.isPending}
							class="mt-2 w-full gap-2.5 rounded-lg px-4 py-3 text-base"
						>
							{#if registerMutation.isPending}
								<div
									class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"
								></div>
								<span>Membuat Akun...</span>
							{:else}
								<span>Buat Akun</span>
							{/if}
						</Button>
					</form>
				{/if}

				<p class="text-center text-sm text-muted">
					Sudah Punya Akun?
					<a href={resolve('/login')} class="text-primary-600 font-semibold hover:underline ml-1">
						Masuk
					</a>
				</p>

				{#if !availability.emailDeliveryOff}
					<p class="text-center text-xs text-muted">
						Sakala belum memiliki Ketentuan Layanan dan Kebijakan Privasi tertulis. Nama, email, dan
						kata sandi yang kamu isi dipakai untuk membuat akun dan mengirim email verifikasi.
					</p>
				{/if}
			</div>
		</div>
	</div>
	<AuthBranding mode="register" />
</main>

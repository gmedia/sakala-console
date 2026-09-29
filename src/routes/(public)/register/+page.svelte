<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { redirectToGithubAuth, redirectToGoogleAuth } from '$lib/features/auth/utils/oauth';
	import AuthBranding from '$lib/features/auth/components/AuthBranding.svelte';
	import SocialLogo from '$lib/features/auth/components/SocialLogo.svelte';
	import { Eye, EyeSlash } from 'phosphor-svelte';
	import { useRegister } from '$lib/features/auth/mutations';
	import { ApiError } from '$lib/api/errors';

	let authMethod = $derived(page.url.searchParams.get('method') === 'email' ? 'email' : 'choice');

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

	type ProviderId = 'github' | 'google' | 'email';
	const authProviders: { id: ProviderId; name: string }[] = [
		{ id: 'github', name: 'Github' },
		{ id: 'google', name: 'Google' },
		{ id: 'email', name: 'Email' }
	];

	function handleProviderClick(id: ProviderId) {
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
		} else {
			console.log(`Daftar dengan ${id}`);
		}
	}

	function handleEmailInput() {
		if (errors.email) {
			if (!email.trim()) {
				errors.email = 'Anda belum memasukkan Alamat Email.';
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
				errors.name = 'Anda belum memasukkan Nama Lengkap.';
			} else {
				errors.name = '';
			}
		}
	}

	function handlePasswordInput() {
		if (errors.password) {
			if (!password) {
				errors.password = 'Anda belum membuat Kata Sandi.';
			} else if (password.length < 8) {
				errors.password = 'Minimal 8 karakter dengan kombinasi huruf, angka, dan simbol.';
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
				errors.confirmPass = 'Anda belum konfirmasi Kata Sandi.';
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
			errors.email = 'Anda belum memasukkan Alamat Email.';
			isValid = false;
		} else if (!email.includes('@')) {
			errors.email = 'Format email tidak valid.';
			isValid = false;
		}

		if (!name.trim()) {
			errors.name = 'Anda belum memasukkan Nama Lengkap.';
			isValid = false;
		}

		if (!password) {
			errors.password = 'Anda belum membuat Kata Sandi.';
			isValid = false;
		} else if (password.length < 8) {
			errors.password = 'Minimal 8 karakter dengan kombinasi huruf, angka, dan simbol.';
			isValid = false;
		}

		if (!confirmPass) {
			errors.confirmPass = 'Anda belum konfirmasi Kata Sandi.';
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

<main class="min-h-screen grid grid-cols-1 lg:grid-cols-10">
	<div class="flex flex-col justify-center items-center bg-white p-8 sm:p-12 lg:p-16 lg:col-span-4">
		<div class="w-full max-w-lg space-y-8">
			<div class="space-y-2">
				<h2 class="text-4xl font-semibold text-zinc-950 tracking-tight">
					{authMethod === 'email' ? 'Daftar Dengan Email' : 'Daftar'}
				</h2>
				<p class="text-sm text-zinc-500 font-normal">Buat akun pengembang Anda hari ini.</p>
			</div>

			<div class="space-y-6">
				{#if authMethod === 'choice'}
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
					<div class="rounded-lg bg-teal-50 border border-[#0F766E]/20 p-6 text-center space-y-3">
						<div class="text-[#0F766E] font-semibold text-lg">Pendaftaran Berhasil!</div>
						<p class="text-sm text-zinc-600">
							Tautan verifikasi telah dikirim ke <strong class="text-zinc-900">{email}</strong>.
							Silakan periksa kotak masuk atau spam email Anda untuk mengaktifkan akun.
						</p>
						<div class="pt-2">
							<a
								href={resolve('/login')}
								class="inline-block px-5 py-2.5 bg-[#0F766E] text-white text-sm font-semibold rounded-lg hover:bg-[#0e6b64] transition-colors"
							>
								Kembali ke Halaman Masuk
							</a>
						</div>
					</div>
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
								placeholder="Masukkan alamat email Anda"
								bind:value={email}
								oninput={handleEmailInput}
								class="w-full rounded-lg border border-[#0F766E] bg-white px-4 py-3 text-sm font-medium placeholder-zinc-400 focus:border-[#0e6b64] focus:ring-1 focus:ring-[#0e6b64] focus:outline-none transition-colors {errors.email
									? 'border-red-400 bg-red-50/20 text-red-500 placeholder-red-300 focus:border-red-500'
									: 'border-[#0F766E] bg-white text-zinc-800 placeholder-zinc-400 focus:border-[#0e6b64]'}"
								required
							/>
							{#if errors.email}
								<p class="text-xs text-red-500 font-normal">{errors.email}</p>
							{/if}
						</div>

						<div class="space-y-1.5 flex flex-col">
							<label for="name" class="text-sm font-semibold text-zinc-700">Nama Lengkap</label>
							<input
								id="name"
								type="text"
								placeholder="Masukkan nama lengkap Anda"
								bind:value={name}
								oninput={handleNameInput}
								class="w-full rounded-lg border border-[#0F766E] bg-white px-4 py-3 text-sm font-medium placeholder-zinc-400 focus:border-[#0e6b64] focus:ring-1 focus:ring-[#0e6b64] focus:outline-none transition-colors {errors.name
									? 'border-red-400 bg-red-50/20 text-red-500 placeholder-red-300 focus:border-red-500'
									: 'border-[#0F766E] bg-white text-zinc-800 placeholder-zinc-400 focus:border-[#0e6b64]'}"
								required
							/>
							{#if errors.name}
								<p class="text-xs text-red-500 font-normal">{errors.name}</p>
							{/if}
						</div>

						<div class="space-y-1.5 flex flex-col">
							<label for="password" class="text-sm font-semibold text-zinc-700">Kata Sandi</label>
							<div class="relative flex items-center">
								<input
									id="password"
									type={showPassword ? 'text' : 'password'}
									placeholder="Buatlah kata sandi Anda"
									bind:value={password}
									oninput={handlePasswordInput}
									class="w-full rounded-lg border border-[#0F766E] bg-white pl-4 pr-11 py-3 text-sm font-medium placeholder-zinc-400 focus:border-[#0e6b64] focus:ring-1 focus:ring-[#0e6b64] focus:outline-none transition-colors {errors.password
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
							<p class="text-xs font-normal {errors.password ? 'text-red-500' : 'text-[#0e6b64]'}">
								{errors.password || 'Minimal 8 karakter dengan kombinasi huruf, angka, dan simbol.'}
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
									placeholder="Masukkan ulang kata sandi Anda"
									bind:value={confirmPass}
									oninput={handleConfirmPassInput}
									class="w-full rounded-lg border border-[#0F766E] bg-white pl-4 pr-11 py-3 text-sm font-medium placeholder-zinc-400 focus:border-[#0e6b64] focus:ring-1 focus:ring-[#0e6b64] focus:outline-none transition-colors {errors.confirmPass
										? 'border-red-400 bg-red-50/20 text-red-500 placeholder-red-300 focus:border-red-500'
										: 'border-[#0F766E] bg-white text-zinc-800 placeholder-zinc-400 focus:border-[#0e6b64]'}"
									required
								/>
								<button
									type="button"
									onclick={() => (showConfirmPass = !showConfirmPass)}
									class="absolute right-3.5 text-[#0F766E] hover:text-[#0e6b64] p-1 cursor-pointer"
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
							<p
								class="text-xs font-normal {errors.confirmPass ? 'text-red-500' : 'text-[#0e6b64]'}"
							>
								{errors.confirmPass ||
									'Minimal 8 karakter dengan kombinasi huruf, angka, dan simbol.'}
							</p>
						</div>

						<button
							type="submit"
							disabled={registerMutation.isPending}
							class="w-full bg-[#0F766E] hover:bg-[#0e6b64] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2.5 transition-all duration-200 hover:shadow-sm cursor-pointer mt-2"
						>
							{#if registerMutation.isPending}
								<div
									class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"
								></div>
								<span>Membuat Akun...</span>
							{:else}
								<span>Buat Akun</span>
							{/if}
						</button>
					</form>
				{/if}

				<p class="text-center text-sm text-zinc-500">
					Sudah Punya Akun?
					<a href={resolve('/login')} class="text-[#0e6b64] font-semibold hover:underline ml-1">
						Masuk
					</a>
				</p>

				<p class="text-center text-xs text-zinc-500">
					Dengan mendaftar, Anda menyetujui <span class="text-[#0e6b64] font-semibold"
						>Ketentuan Layanan</span
					>
					dan <span class="text-[#0e6b64] font-semibold">Kebijakan Privasi</span> kami.
				</p>
			</div>
		</div>
	</div>
	<AuthBranding mode="register" />
</main>

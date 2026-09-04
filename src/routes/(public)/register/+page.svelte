<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { redirectToGithubAuth } from '$lib/features/auth/utils/oauth';
	import AuthBranding from '$lib/features/auth/components/AuthBranding.svelte';
	import SocialLogo from '$lib/features/auth/components/SocialLogo.svelte';
	import { Eye, EyeClosed } from 'phosphor-svelte';

	let authMethod = $derived(page.url.searchParams.get('method') === 'email' ? 'email' : 'choice');

	let email = $state('');
	let password = $state('');
	let confirmPass = $state('');
	let showPassword = $state(false);
	let showConfirmPass = $state(false);
	let errors = $state({ email: '', password: '', confirmPass: '' });

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
			// blm ada
		} else {
			console.log(`Daftar dengan ${id}`);
		}
	}

	function validateLogin() {
		let isValid = true;
		errors.email = '';
		errors.password = '';
		errors.confirmPass = '';

		if (!email.trim()) {
			errors.email = 'Anda belum memasukkan Alamat Email.';
			isValid = false;
		} else if (!email.includes('@')) {
			errors.email = 'Format email tidak valid.';
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

	function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (validateLogin()) {
			// handle submit
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
				<h2 class="text-4xl font-semibold text-zinc-950 tracking-tight">Daftar</h2>
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
				{:else}
					<form class="space-y-4" onsubmit={handleSubmit} novalidate>
						<div class="space-y-1.5 flex flex-col">
							<label for="email" class="text-sm font-semibold text-zinc-700">Email</label>
							<input
								id="email"
								type="email"
								placeholder="example@gmail.com"
								bind:value={email}
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
							<label for="password" class="text-sm font-semibold text-zinc-700">Kata Sandi</label>
							<div class="relative flex items-center">
								<input
									id="password"
									type={showPassword ? 'text' : 'password'}
									placeholder="Buat Kata Sandi Anda"
									bind:value={password}
									class="w-full rounded-lg border border-[#0F766E] bg-white pl-4 pr-11 py-3 text-sm font-medium placeholder-zinc-400 focus:border-[#0e6b64] focus:ring-1 focus:ring-[#0e6b64] focus:outline-none transition-colors {errors.password
										? 'border-red-400 bg-red-50/20 text-red-500 placeholder-red-300 focus:border-red-500'
										: 'border-[#0F766E] bg-white text-zinc-800 placeholder-zinc-400 focus:border-[#0e6b64]'}"
									required
								/>
								<button
									type="button"
									onclick={() => (showPassword = !showPassword)}
									class="absolute right-3.5 text-[#0F766E] hover:text-[#0e6b64] p-1 cursor-pointer"
								>
									{#if showPassword}
										<EyeClosed size={20} />
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
									placeholder="Masukkan Ulang Kata Sandi Anda"
									bind:value={confirmPass}
									class="w-full rounded-lg border border-[#0F766E] bg-white pl-4 pr-11 py-3 text-sm font-medium placeholder-zinc-400 focus:border-[#0e6b64] focus:ring-1 focus:ring-[#0e6b64] focus:outline-none transition-colors {errors.confirmPass
										? 'border-red-400 bg-red-50/20 text-red-500 placeholder-red-300 focus:border-red-500'
										: 'border-[#0F766E] bg-white text-zinc-800 placeholder-zinc-400 focus:border-[#0e6b64]'}"
									required
								/>
								<button
									type="button"
									onclick={() => (showConfirmPass = !showConfirmPass)}
									class="absolute right-3.5 text-[#0F766E] hover:text-[#0e6b64] p-1 cursor-pointer"
								>
									{#if showConfirmPass}
										<EyeClosed size={20} />
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
							class="w-full bg-[#0F766E] hover:bg-[#0e6b64] text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2.5 transition-all duration-200 hover:shadow-sm cursor-pointer mt-2"
						>
							<span>Buat Akun</span>
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

<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { redirectToGithubAuth } from '$lib/features/auth/utils/oauth';
	import { resolve } from '$app/paths';
	import AuthBranding from '$lib/features/auth/components/AuthBranding.svelte';
	import SocialLogo from '$lib/features/auth/components/SocialLogo.svelte';
	import { Eye, EyeSlash } from 'phosphor-svelte';

	let authMethod = $derived(page.url.searchParams.get('method') === 'email' ? 'email' : 'choice');

	let email = $state('');
	let password = $state('');
	let showPassword = $state(false);
	let errors = $state({
		email: '',
		password: '',
		general: ''
	});

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

			goto(resolve(`/login${query}` as '/login'), { keepFocus: true });
		} else if (id === 'github') {
			redirectToGithubAuth(returnTo);
		} else if (id === 'google') {
			// blm ada
		} else {
			console.log(`Login dengan ${id}`);
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

	function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (validateLogin()) {
			// handle submit
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
							class="w-full bg-[#0F766E] hover:bg-[#0e6b64] text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2.5 transition-all duration-200 hover:shadow-sm cursor-pointer mt-2"
						>
							<span>Lanjutkan dengan Email</span>
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

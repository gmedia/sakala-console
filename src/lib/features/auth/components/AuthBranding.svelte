<script lang="ts">
	import SakalaLogo from '$lib/assets/sakala-logo.svg';
	import SocialLogo from '$lib/features/auth/components/SocialLogo.svelte';

	type ProviderId = 'github' | 'google' | 'email' | 'radio' | 'sparkles' | 'link';

	type Props = {
		mode: 'login' | 'register';
	};

	let { mode }: Props = $props();

	const registerItems: { id: ProviderId; desc: string }[] = [
		{ id: 'radio', desc: 'Deteksi Projek Anda' },
		{ id: 'sparkles', desc: 'Deploy Otomatis' },
		{ id: 'link', desc: 'URL Website Siap Digunakan' }
	];
</script>

<div
	class="hidden lg:flex flex-col justify-center items-center bg-[#0e6b64] text-white p-16 select-none relative overflow-hidden lg:col-span-1"
>
	<div class="relative z-10 max-w-lg my-auto space-y-6">
		<img src={SakalaLogo} alt="Sakala" class="h-10 w-auto" />

		{#if mode === 'login'}
			<h1 class="text-5xl font-bold tracking-tight leading-[1.1] text-white">
				Build,<br />Deploy,<br />Scale.
			</h1>
			<p class="text-teal-50/80 leading-relaxed text-md font-normal">
				Infrastruktur modern untuk pengembang masa depan. Kelola aplikasi Anda dengan efisiensi
				terminal dan keandalan tingkat enterprise.
			</p>
		{:else}
			<h1 class="text-5xl font-bold tracking-tight leading-[1.1] text-white">Mulai Membangun.</h1>
			<p class="text-teal-50/80 leading-relaxed text-md font-normal">
				Berhenti membatasi karya hanya di Local. Daftar sekarang dan mulailah pengalaman deployment
				dengan langkah yang mudah.
			</p>

			<div class="space-y-2 pt-2">
				{#each registerItems as item (item.id ?? item)}
					<div
						class="w-full bg-white/15 border border-zinc-200 py-2 px-3 rounded-lg flex items-center gap-3 transition-all duration-200"
					>
						<SocialLogo name={item.id} />
						<span class="text-sm font-medium">{item.desc}</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

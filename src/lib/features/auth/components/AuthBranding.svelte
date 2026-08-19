<script lang="ts">
	import SakalaLogo from '$lib/assets/sakala-logo.svg';
	import { Check, Copyright } from '@lucide/svelte';
	import AccentBG from '$lib/assets/bg.png';

	type Props = {
		mode: 'login' | 'register';
	};

	let { mode }: Props = $props();

	const registerItems: { desc: string }[] = [
		{ desc: 'Deteksi Projek Anda' },
		{ desc: 'Deploy Otomatis' },
		{ desc: 'URL Website Siap Digunakan' }
	];
</script>

<div
	class="hidden lg:flex flex-col justify-between items-center bg-gradient-to-br from-[#0F766E] via-[#128F86] via-[#15A99E] to-[#1CDCCD] text-white p-16 select-none relative overflow-hidden lg:col-span-6"
>
	<img
		src={AccentBG}
		alt=""
		class="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-20 mix-blend-overlay"
	/>

	<div class="relative z-10 w-full flex">
		<img src={SakalaLogo} alt="Sakala" class="h-12" />
	</div>
	<div class="relative z-10 my-auto space-y-6">
		{#if mode === 'login'}
			<h1 class="text-5xl font-bold tracking-tight leading-[1.1] text-white">
				Build,<br />Deploy,<br />Scale.
			</h1>
			<p class="text-teal-50/80 text-xl font-normal">
				Infrastruktur modern untuk pengembang masa depan. Kelola aplikasi Anda dengan efisiensi
				terminal dan keandalan tingkat enterprise.
			</p>
		{:else}
			<h1 class="text-5xl font-bold tracking-tight leading-[1.1] text-white">Mulai Membangun.</h1>
			<p class="text-teal-50/80 leading-relaxed text-xl font-normal">
				Berhenti membatasi karya hanya di Local. Daftar sekarang dan mulailah pengalaman deployment
				dengan langkah yang mudah.
			</p>

			<div class="space-y-2 pt-2">
				{#each registerItems as item (item.desc ?? item)}
					<div
						class="w-full py-2 px-3 rounded-lg flex items-center gap-3 transition-all duration-200"
					>
						<Check size={20} color="#ffffff" />
						<span class="text-md font-medium">{item.desc}</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<div class="mt-16 flex items-center gap-1.5 w-full">
		<Copyright class="size-4" color="#ffffff" />
		<span>Sakala Systems. Build for Builders</span>
	</div>
</div>

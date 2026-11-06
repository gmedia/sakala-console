<script lang="ts">
	import SakalaLogo from '$lib/assets/sakala-logo.svg';
	import Check from '@lucide/svelte/icons/check';
	import Copyright from '@lucide/svelte/icons/copyright';
	import AccentBG from '$lib/assets/bg.png';

	type Props = {
		mode: 'login' | 'register';
	};

	let { mode }: Props = $props();

	const registerItems: { desc: string }[] = [
		{ desc: 'Sakala memeriksa repository sebelum deploy' },
		{ desc: 'Log dan status tiap tahap bisa kamu baca' },
		{ desc: 'URL publik begitu deployment berhasil' }
	];
</script>

<div
	class="hidden lg:flex flex-col justify-between items-center bg-gradient-to-br from-primary via-primary via-80% to-brand-glow text-white p-16 select-none relative overflow-hidden lg:col-span-6"
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
			<p class="text-5xl font-bold tracking-tight leading-[1.1] text-white">
				Build,<br />Deploy,<br />Baca log-nya.
			</p>
			<p class="text-white text-xl font-normal">
				Hubungkan repository GitHub, deploy dari sini, lalu pantau status dan log-nya kalau ada yang
				gagal.
			</p>
		{:else}
			<p class="text-5xl font-bold tracking-tight leading-[1.1] text-white">Mulai Membangun.</p>
			<p class="text-white leading-relaxed text-xl font-normal">
				Dari repository GitHub ke URL publik. Daftar, pilih repository, lalu deploy proyek
				pertamamu.
			</p>

			<div class="space-y-2 pt-2">
				{#each registerItems as item (item.desc ?? item)}
					<div
						class="w-full py-2 px-3 rounded-lg flex items-center gap-3 transition-all duration-200"
					>
						<Check size={20} class="text-white" />
						<span class="text-base font-medium">{item.desc}</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<div class="mt-16 flex items-center gap-1.5 w-full">
		<Copyright class="size-4 text-white" />
		<span>2026 Sakala Contributors · Apache-2.0</span>
	</div>
</div>

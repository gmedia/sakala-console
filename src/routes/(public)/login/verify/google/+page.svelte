<script lang="ts">
	import Badge from '$lib/components/ui/Badge.svelte';
	import { Mail, BadgeCheck, ArrowLeft } from '@lucide/svelte';
	import { resolve } from '$app/paths';

	let status = $state<'pending' | 'success'>('pending');

	function handleSimulateSuccess() {
		status = 'success';
	}
</script>

<svelte:head>
	<title
		>{status === 'pending' ? 'Verifikasi Email' : 'Verifikasi Email Berhasil'} | Sakala Console</title
	>
</svelte:head>

<header class="relative flex min-h-screen flex-col items-center justify-center p-4 pb-24 sm:p-8">
	{#if status === 'pending'}
		<div class="w-full max-w-2xl text-center">
			<Badge
				tone="success"
				class="border-[#0F766E] bg-[#E7F1F1] text-sm font-semibold text-[#0F766E] [&>span:first-child]:hidden"
			>
				Menunggu Verifikasi
			</Badge>

			<h1 class="mt-3 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
				Verifikasi Email Anda
			</h1>

			<p class="mx-auto mt-2 max-w-2xl text-sm leading-6 sm:text-base sm:leading-7">
				Untuk melanjutkan ke <span class="font-semibold text-[#0e6b64]">Sakala</span>, verifikasi
				identitas Anda melalui Email untuk keamanan tambahan.
			</p>
		</div>

		<div
			class="mt-8 flex w-full max-w-lg items-start gap-4 rounded-lg border border-[#0e6b64] p-4 sm:items-center"
		>
			<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#E7F1F1]">
				<Mail color="#0F766E" size={28} />
			</div>
			<div>
				<b class="text-zinc-900">Cek Email</b>
				<p class="text-sm text-zinc-600">Periksa kotak masuk email Anda untuk tautan konfirmasi.</p>
			</div>
		</div>

		<p class="mt-8 text-center text-sm text-zinc-500">
			Belum menerima email? Cek folder spam Anda atau
			<button
				type="button"
				onclick={handleSimulateSuccess}
				class="ml-1 font-semibold text-[#0e6b64] hover:underline cursor-pointer"
			>
				Kirim ulang email.
			</button>
		</p>

		<button
			class="mt-8 flex items-center justify-center gap-2 text-sm font-medium text-zinc-700 cursor-pointer"
			onclick={() => history.back()}
		>
			<ArrowLeft size={16} />
			Kembali
		</button>
	{:else}
		<div class="w-full max-w-2xl text-center">
			<Badge
				tone="success"
				class="border-[#0F766E] bg-[#E7F1F1] text-sm font-semibold text-[#0F766E] [&>span:first-child]:hidden"
			>
				Verifikasi Selesai
			</Badge>

			<h1 class="mt-3 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
				Verifikasi Email Berhasil
			</h1>

			<p class="mx-auto mt-2 max-w-xl text-sm leading-6 sm:text-base sm:leading-7">
				Identitas Anda telah terverifikasi dengan aman melalui Email. Mari kita mulai menyiapkan
				dashboard pengembang Anda di <span class="font-semibold text-[#0e6b64]">Sakala</span>.
			</p>
		</div>

		<div class="mt-8 flex items-center justify-center">
			<BadgeCheck size={80} class="text-[#0e6b64]" />
		</div>

		<div class="mt-8 w-full max-w-xs">
			<a
				href={resolve('/login')}
				class="flex w-full items-center justify-center rounded-lg bg-[#0e6b64] px-4 py-3 font-semibold text-white transition-all hover:bg-[#0c5852] shadow-sm text-center"
			>
				Masuk
			</a>
		</div>
	{/if}
</header>

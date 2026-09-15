<script lang="ts">
	import { BookOpen, RocketLaunch } from 'phosphor-svelte';
	import OnboardingError from './OnboardingError.svelte';
	import Button from '$lib/components/ui/Button.svelte';

	type Props = {
		isPending?: boolean;
		errorMessage?: string | null;
		onFinish: () => void;
		onBack?: () => void;
	};

	let { isPending = false, errorMessage, onFinish, onBack }: Props = $props();
</script>

<div class="mx-auto w-full py-12 px-6 md:px-25">
	<!-- Block 1: Header Section -->
	<div>
		<!-- Badge -->
		<div class="mb-10">
			<span
				class="inline-block rounded-lg border border-primary/40 bg-primary-50/50 px-3 py-1 font-mono text-[14px] text-primary"
			>
				Langkah 3 dari 3
			</span>
		</div>

		<!-- Heading -->
		<h1 class="text-3xl font-bold tracking-tight text-black sm:text-4xl">Siap Membangun</h1>
		<p class="mt-2 text-sm text-black">
			Selamat! Workspace Anda telah dikonfigurasi dengan sempurna. Sekarang saatnya mengubah ide
			menjadi kenyataan dengan Sakala.
		</p>
	</div>

	{#if errorMessage}
		<OnboardingError title="Verifikasi workspace gagal." description={errorMessage} />
	{/if}

	<!-- Block 2: 3 Cards & Terminal Snippet Section (80px gap from header) -->
	<div class="mt-20">
		<!-- 3 Cards (8px gap between cards) -->
		<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
			<!-- Card 1 -->
			<div
				class="flex min-h-[181px] w-full flex-col justify-start rounded-lg border border-primary-100 bg-surface pl-4 pr-[32px] pt-4 pb-5 text-left transition-all lg:w-full"
			>
				<div class="mb-4 flex items-center justify-between">
					<BookOpen size={20} class="text-primary" />
					<span class="text-sm font-medium text-primary">Ready</span>
				</div>
				<div class="w-66.25 tracking-[0px]">
					<h3 class="font-sans text-[22px] font-medium tracking-[0px] text-black">SDK Explorer</h3>
					<p
						class="mt-2 font-sans text-[18px] font-normal leading-snug tracking-[0px] text-black/70"
					>
						Akses dokumentasi API dari Library langsung dari workspace Anda.
					</p>
				</div>
			</div>

			<!-- Card 2 -->
			<div
				class="flex min-h-[181px] w-full flex-col justify-start rounded-lg border border-primary-100 bg-surface pl-4 pr-[32px] pt-4 pb-5 text-left transition-all lg:w-full"
			>
				<div class="mb-4 flex items-center justify-between">
					<RocketLaunch size={20} class="text-primary" />
					<span class="text-sm font-medium text-primary">Active</span>
				</div>
				<div class="w-[265px] tracking-[0px]">
					<h3 class="font-sans text-[22px] font-medium tracking-[0px] text-black">Auto-Deploy</h3>
					<p
						class="mt-2 font-sans text-[18px] font-normal leading-snug tracking-[0px] text-black/70"
					>
						Pipeline CI/CD sudah siap untuk pengiriman kode secara otomatis.
					</p>
				</div>
			</div>
		</div>

		<!-- Terminal Snippet (32px gap from cards) -->
		<div
			class="mt-8 mx-auto flex h-33 w-[384px] flex-col justify-between rounded-sm bg-[#213145] px-4 py-4 text-left font-mono text-[12px] font-normal leading-[19.5px] text-[#F8F9FF]"
		>
			<div class="mb-[11.25px] flex gap-1.5">
				<div class="size-2.5 rounded-full bg-[#EF4444]"></div>
				<div class="size-2.5 rounded-full bg-[#EAB308]"></div>
				<div class="size-2.5 rounded-full bg-[#22C55E]"></div>
			</div>
			<div>
				<p><span class="text-[#89F5E7]">sakala</span> init --complete</p>
				<p class="text-[#BCC9C6]">// Workspace verified</p>
				<p class="text-[#BCC9C6]">// Environment variables set</p>
				<p class="text-[#89F5E7]">Ready to start...</p>
			</div>
		</div>
	</div>

	{#if errorMessage}
		<div
			role="alert"
			class="mt-6 rounded-lg border border-error/30 bg-error/5 px-4 py-3 text-sm text-error"
		>
			{errorMessage}
		</div>
	{/if}

	<!-- Block 3: Footer Navigation Controls (80px gap from cards/snippet) -->
	<div class="mt-20 flex items-center justify-between pt-6 text-left">
		<Button
			type="button"
			onclick={onBack}
			disabled={!onBack || isPending}
			class="flex h-11.75 w-40.5 items-center justify-center rounded-lg border border-border bg-white text-[22px] font-medium text-black transition-colors hover:bg-background disabled:opacity-30"
		>
			Kembali
		</Button>

		<Button
			type="button"
			onclick={onFinish}
			disabled={isPending}
			class="flex h-11.75 w-40.5 items-center justify-center rounded-lg bg-primary text-[22px] font-normal text-white transition-colors hover:bg-primary-dark hover:text-white disabled:opacity-60"
		>
			{isPending ? 'Memproses...' : 'Lanjutkan'}
		</Button>
	</div>
</div>

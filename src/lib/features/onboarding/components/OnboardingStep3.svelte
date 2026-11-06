<script lang="ts">
	import BookOpen from 'phosphor-svelte/lib/BookOpen';
	import RocketLaunch from 'phosphor-svelte/lib/RocketLaunch';
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
			Tinggal satu langkah. Setelah ini, hubungkan repository dan deploy proyek pertamamu.
		</p>
	</div>

	{#if errorMessage}
		<OnboardingError title="Onboarding belum bisa diselesaikan." description={errorMessage} />
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
					<span class="text-sm font-medium text-primary">Tersedia</span>
				</div>
				<div class="w-full max-w-66.25 tracking-[0px]">
					<h3 class="font-sans text-[22px] font-medium tracking-[0px] text-black">Panduan</h3>
					<p
						class="mt-2 font-sans text-[18px] font-normal leading-snug tracking-[0px] text-black/70"
					>
						Panduan deploy pertama ada di
						<a
							href="https://sakala.dev/docs/deploy-pertama"
							target="_blank"
							rel="noreferrer noopener"
							class="wrap-anywhere text-primary underline underline-offset-2"
						>
							sakala.dev/docs/deploy-pertama</a
						>, dan selalu bisa dibuka dari menu.
					</p>
				</div>
			</div>

			<!-- Card 2 -->
			<div
				class="flex min-h-[181px] w-full flex-col justify-start rounded-lg border border-primary-100 bg-surface pl-4 pr-[32px] pt-4 pb-5 text-left transition-all lg:w-full"
			>
				<div class="mb-4 flex items-center justify-between">
					<RocketLaunch size={20} class="text-primary" />
					<span class="text-sm font-medium text-primary">Bisa diatur</span>
				</div>
				<div class="w-full max-w-66.25 tracking-[0px]">
					<h3 class="font-sans text-[22px] font-medium tracking-[0px] text-black">Auto-Deploy</h3>
					<p
						class="mt-2 font-sans text-[18px] font-normal leading-snug tracking-[0px] text-black/70"
					>
						Push ke branch proyek bisa langsung memicu deploy. Atur per proyek di Pengaturan.
					</p>
				</div>
			</div>
		</div>

		<!-- Terminal Snippet (32px gap from cards) -->
		<div
			class="mt-8 mx-auto flex w-full max-w-96 flex-col justify-between gap-3 rounded-sm bg-terminal px-4 py-4 text-left font-mono text-[12px] font-normal leading-[19.5px] text-terminal-text"
		>
			<div>
				<p class="font-semibold">Langkah berikutnya</p>
				<p>1. Pilih repository GitHub</p>
				<p>2. Atur branch dan environment variable</p>
				<p>3. Deploy, lalu baca log-nya</p>
			</div>
		</div>
	</div>

	<!-- Block 3: Footer Navigation Controls (80px gap from cards/snippet) -->
	<div class="mt-20 flex flex-wrap items-center justify-between gap-2 pt-6 text-left">
		<Button
			type="button"
			onclick={onBack}
			disabled={!onBack || isPending}
			class="flex h-11.75 w-28 shrink-0 items-center justify-center rounded-lg border border-border-strong bg-surface text-base font-medium text-foreground transition-colors hover:bg-background disabled:opacity-30 sm:w-40.5 sm:text-[22px]"
		>
			Kembali
		</Button>

		<Button
			type="button"
			onclick={onFinish}
			disabled={isPending}
			class="flex h-11.75 w-28 shrink-0 items-center justify-center rounded-lg bg-primary text-base font-normal text-white transition-colors hover:bg-primary-dark hover:text-white sm:w-40.5 sm:text-[22px]"
		>
			{isPending ? 'Memproses...' : 'Lanjutkan'}
		</Button>
	</div>
</div>

<script lang="ts">
	import {
		GraduationCap,
		ShareNetwork,
		UsersThree,
		GoogleLogo,
		SpeakerHigh,
		GithubLogo,
		Files,
		DotsThree
	} from 'phosphor-svelte';
	import { cn } from '$lib/utils/cn';
	import { ONBOARDING_SOURCE_VALUES, ONBOARDING_SOURCE_OPTIONS_MAP } from '../constants';
	import type { OnboardingSource } from '$lib/api/resources/onboarding';
	import type { Component } from 'svelte';
	import OnboardingError from './OnboardingError.svelte';
	import Button from '$lib/components/ui/Button.svelte';

	type Props = {
		selectedSource?: OnboardingSource;
		isSubmitPending: boolean;
		isSkipPending: boolean;
		errorMessage?: string | null;
		onSelect: (source: OnboardingSource) => void;
		onNext: () => void;
		onSkip?: () => void;
		onBack?: () => void;
	};

	let {
		selectedSource,
		isSubmitPending,
		errorMessage,
		isSkipPending,
		onSelect,
		onNext,
		onSkip,
		onBack
	}: Props = $props();

	const ICONS: Record<OnboardingSource, Component> = {
		campus: GraduationCap,
		social_media: ShareNetwork,
		friend: UsersThree,
		gmedia: GoogleLogo,
		community: SpeakerHigh,
		github: GithubLogo,
		workshop: Files,
		other: DotsThree
	};
</script>

<div class="mx-auto w-full py-12 px-6 md:px-27">
	<!-- Badge -->
	<div class="mb-10">
		<span
			class="inline-block rounded-lg border border-primary/40 bg-primary-50/50 px-3 py-1 font-mono text-[14px] text-primary"
		>
			Langkah 1 dari 3
		</span>
	</div>

	<!-- Heading -->
	<h1 class="text-3xl font-bold tracking-tight text-black sm:text-4xl">
		Dari mana Anda mengetahui <span class="text-primary">Sakala?</span>
	</h1>
	<p class="mt-2 text-sm text-black">Bantu kami memahami bagaimana Anda menemukan platform kami.</p>

	{#if errorMessage}
		<OnboardingError title="Gagal menyimpan pilihan anda." description={errorMessage} />
	{/if}

	<!-- Column Options Grid -->
	<div class="mt-10 grid w-full grid-cols-1 gap-y-4 gap-x-6 sm:grid-cols-2">
		{#each ONBOARDING_SOURCE_VALUES as source (source)}
			{@const Icon = ICONS[source]}
			{@const isSelected = selectedSource === source}
			<label
				class={cn(
					'flex h-16.5 w-full cursor-pointer items-center gap-3.5 rounded-lg border px-4 text-left transition-all focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2',
					isSelected
						? 'border-primary bg-primary-50/40 text-black ring-1 ring-primary'
						: 'border-border-strong bg-surface text-black hover:border-primary/40 hover:bg-background/50'
				)}
			>
				<input
					type="radio"
					name="onboarding-source"
					value={source}
					checked={isSelected}
					disabled={isSubmitPending || isSkipPending}
					onchange={() => onSelect(source)}
					class="sr-only"
				/>
				<div
					class={cn(
						'flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors',
						isSelected ? 'bg-primary text-white' : 'bg-primary-50 text-primary'
					)}
				>
					<Icon size={18} weight="regular" />
				</div>
				<span class="text-sm font-normal text-black">{ONBOARDING_SOURCE_OPTIONS_MAP[source]}</span>
			</label>
		{/each}
	</div>

	<!-- Footer Navigation Controls -->
	<div class="mt-20 flex items-center justify-between pt-6">
		<Button
			type="button"
			onclick={onBack}
			disabled={!onBack || isSubmitPending || isSkipPending}
			class="flex h-11.75 w-28 shrink-0 items-center justify-center rounded-lg border border-border bg-white text-base font-medium text-black transition-colors hover:bg-background disabled:opacity-30 sm:w-40.5 sm:text-[22px]"
		>
			Kembali
		</Button>

		<div class="flex items-center gap-2">
			<Button
				type="button"
				onclick={onSkip}
				disabled={isSubmitPending || isSkipPending}
				class="flex h-11.75 w-28 shrink-0 items-center justify-center rounded-lg border border-border bg-white text-base font-medium text-black transition-colors hover:bg-background sm:w-40.5 sm:text-[22px]"
			>
				{isSkipPending ? 'Melewati...' : 'Lewati'}
			</Button>

			<Button
				type="button"
				onclick={onNext}
				disabled={!selectedSource || isSubmitPending || isSkipPending}
				class="flex h-11.75 w-28 shrink-0 items-center justify-center rounded-lg bg-primary text-base font-normal text-white transition-colors hover:bg-primary-dark hover:text-white sm:w-40.5 sm:text-[22px]"
			>
				{isSubmitPending ? 'Menyimpan...' : 'Lanjutkan'}
			</Button>
		</div>
	</div>
</div>

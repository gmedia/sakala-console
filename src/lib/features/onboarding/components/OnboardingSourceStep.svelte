<script lang="ts">
	import Buildings from 'phosphor-svelte/lib/Buildings';
	import GraduationCap from 'phosphor-svelte/lib/GraduationCap';
	import ShareNetwork from 'phosphor-svelte/lib/ShareNetwork';
	import UsersThree from 'phosphor-svelte/lib/UsersThree';
	import SpeakerHigh from 'phosphor-svelte/lib/SpeakerHigh';
	import Files from 'phosphor-svelte/lib/Files';
	import DotsThree from 'phosphor-svelte/lib/DotsThree';
	import { cn } from '$lib/utils/cn';
	import { ONBOARDING_SOURCE_VALUES, ONBOARDING_SOURCE_OPTIONS_MAP } from '../constants';
	import type { OnboardingSource } from '$lib/api/resources/onboarding';
	import type { Component } from 'svelte';
	import OnboardingError from './OnboardingError.svelte';
	import OnboardingShell from './OnboardingShell.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import SocialLogo from '$lib/features/auth/components/SocialLogo.svelte';

	type Props = {
		selectedSource?: OnboardingSource;
		isSubmitPending: boolean;
		isSkipPending: boolean;
		errorMessage?: string | null;
		onSelect: (source: OnboardingSource) => void;
		onNext: () => void;
		onSkip: () => void;
		onBack: () => void;
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

	const isBusy = $derived(isSubmitPending || isSkipPending);

	// GMEDIA gets a neutral icon: no other company's logo stands in for it, and no GMEDIA logo is used
	// without the official asset and permission. GitHub uses its own mark, handled in the markup.
	const ICONS: Record<Exclude<OnboardingSource, 'github'>, Component> = {
		campus: GraduationCap,
		social_media: ShareNetwork,
		friend: UsersThree,
		gmedia: Buildings,
		community: SpeakerHigh,
		workshop: Files,
		other: DotsThree
	};
</script>

<OnboardingShell
	step={2}
	title="Dari mana kamu tahu Sakala?"
	description="Boleh dilewati. Jawabanmu hanya membantu kami tahu cara orang menemukan Sakala."
>
	{#if errorMessage}
		<OnboardingError title="Gagal menyimpan pilihanmu." description={errorMessage} />
	{/if}

	<div class="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Sumber">
		{#each ONBOARDING_SOURCE_VALUES as source (source)}
			{@const isSelected = selectedSource === source}
			<label
				class={cn(
					'flex min-h-14 cursor-pointer items-center gap-3 rounded-control border px-3 text-left text-sm font-medium transition-colors focus-within:outline-3 focus-within:outline-offset-1 focus-within:outline-primary',
					isSelected
						? 'border-primary bg-primary-50 text-foreground'
						: 'border-border-strong bg-surface text-foreground hover:border-primary'
				)}
			>
				<input
					type="radio"
					name="onboarding-source"
					value={source}
					checked={isSelected}
					disabled={isBusy}
					onchange={() => onSelect(source)}
					class="sr-only"
				/>
				<span class="flex size-8 shrink-0 items-center justify-center text-primary-dark">
					{#if source === 'github'}
						<SocialLogo name="github" />
					{:else}
						{@const Icon = ICONS[source]}
						<Icon size={20} aria-hidden="true" />
					{/if}
				</span>
				{ONBOARDING_SOURCE_OPTIONS_MAP[source]}
			</label>
		{/each}
	</div>

	{#snippet footer()}
		<Button variant="secondary" onclick={onBack} disabled={isBusy}>Kembali</Button>
		<div class="flex items-center gap-2">
			<Button variant="ghost" onclick={onSkip} disabled={isBusy}>
				{isSkipPending ? 'Melewati...' : 'Lewati'}
			</Button>
			<Button onclick={onNext} disabled={!selectedSource || isBusy}>
				{isSubmitPending ? 'Menyimpan...' : 'Lanjutkan'}
			</Button>
		</div>
	{/snippet}
</OnboardingShell>

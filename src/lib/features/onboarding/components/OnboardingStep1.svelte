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
	import type { OnboardingSource } from '../types';

	type Props = {
		selectedSource?: OnboardingSource;
		onSelect: (source: OnboardingSource) => void;
		onNext: () => void;
		onSkip?: () => void;
		onBack?: () => void;
	};

	let { selectedSource, onSelect, onNext, onSkip, onBack }: Props = $props();

	const sources: { id: OnboardingSource; label: string; icon: typeof GraduationCap }[] = [
		{ id: 'campus', label: 'Kampus', icon: GraduationCap },
		{ id: 'social_media', label: 'Media Sosial', icon: ShareNetwork },
		{ id: 'friend', label: 'Teman', icon: UsersThree },
		{ id: 'gmedia', label: 'Gmedia', icon: GoogleLogo },
		{ id: 'community', label: 'Komunitas', icon: SpeakerHigh },
		{ id: 'github', label: 'GitHub', icon: GithubLogo },
		{ id: 'workshop', label: 'Workshop', icon: Files },
		{ id: 'other', label: 'Lainnya', icon: DotsThree }
	];
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

	<!-- Column Options Grid -->
	<div class="mt-10 grid w-full grid-cols-1 gap-y-4 gap-x-6 sm:grid-cols-2">
		{#each sources as source (source.id)}
			{@const Icon = source.icon}
			{@const isSelected = selectedSource === source.id}
			<button
				type="button"
				onclick={() => onSelect(source.id)}
				class={cn(
					'flex h-16.5 w-full items-center gap-3.5 rounded-lg border px-4 text-left transition-all',
					isSelected
						? 'border-primary bg-primary-50/40 text-black ring-1 ring-primary'
						: 'border-border-strong bg-surface text-black hover:border-primary/40 hover:bg-background/50'
				)}
			>
				<div
					class={cn(
						'flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors',
						isSelected ? 'bg-primary text-white' : 'bg-primary-50 text-primary'
					)}
				>
					<Icon size={18} weight="regular" />
				</div>
				<span class="text-sm font-normal text-black">{source.label}</span>
			</button>
		{/each}
	</div>

	<!-- Footer Navigation Controls -->
	<div class="mt-20 flex items-center justify-between pt-6">
		<button
			type="button"
			onclick={onBack}
			disabled={!onBack}
			class="flex h-11.75 w-40.5 items-center justify-center rounded-lg border border-border bg-white text-[22px] font-medium text-black transition-colors hover:bg-background disabled:opacity-30"
		>
			Kembali
		</button>

		<div class="flex items-center gap-2">
			<button
				type="button"
				onclick={onSkip ?? onNext}
				class="flex h-11.75 w-40.5 items-center justify-center rounded-lg border border-border bg-white text-[22px] font-medium text-black transition-colors hover:bg-background"
			>
				Lewati
			</button>

			<button
				type="button"
				onclick={onNext}
				class="flex h-11.75 w-40.5 items-center justify-center rounded-lg bg-primary text-[22px] font-normal text-white transition-colors hover:bg-primary-dark hover:text-white"
			>
				Lanjutkan
			</button>
		</div>
	</div>
</div>

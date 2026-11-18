<script lang="ts">
	import Buildings from 'phosphor-svelte/lib/Buildings';
	import DotsThree from 'phosphor-svelte/lib/DotsThree';
	import Files from 'phosphor-svelte/lib/Files';
	import GraduationCap from 'phosphor-svelte/lib/GraduationCap';
	import ShareNetwork from 'phosphor-svelte/lib/ShareNetwork';
	import SpeakerHigh from 'phosphor-svelte/lib/SpeakerHigh';
	import UsersThree from 'phosphor-svelte/lib/UsersThree';
	import { tick, type Component } from 'svelte';
	import type { OnboardingSource } from '$lib/api/resources/onboarding';
	import { NetworkError } from '$lib/api/errors';
	import Button from '$lib/components/ui/Button.svelte';
	import SocialLogo from '$lib/features/auth/components/SocialLogo.svelte';
	import { useCurrentUser } from '$lib/features/auth/queries';
	import { ONBOARDING_SOURCE_OPTIONS_MAP, ONBOARDING_SOURCE_VALUES } from '../constants';
	import { useSubmitOnboardingSource } from '../mutations';
	import { browserPromptStorage, dismissSourcePrompt, shouldAskSource } from '../source-prompt';

	const currentUser = useCurrentUser();
	const sourceMutation = useSubmitOnboardingSource();

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

	let dismissed = $state(false);
	let answered = $state(false);
	let thanksRef = $state<HTMLElement | null>(null);

	// Read once per user: the answer saved below changes `onboarding_source`, and the thanks stays.
	const asked = $derived(shouldAskSource(currentUser.data, browserPromptStorage()));
	const visible = $derived(answered || (asked && !dismissed));
	const errorMessage = $derived.by(() => {
		if (!sourceMutation.error) return null;
		return sourceMutation.error instanceof NetworkError
			? 'Jawabanmu belum tersimpan karena Sakala tidak bisa dihubungi. Periksa koneksi internet kamu, lalu pilih lagi.'
			: 'Jawabanmu belum tersimpan. Pilih lagi sebentar lagi.';
	});

	function answer(source: OnboardingSource) {
		if (sourceMutation.isPending) return;
		sourceMutation.mutate(
			{ type: 'source', source },
			{
				onSuccess: async () => {
					answered = true;
					await tick();
					thanksRef?.focus();
				}
			}
		);
	}

	function skip() {
		const user = currentUser.data;
		if (user) dismissSourcePrompt(browserPromptStorage(), user.id);
		dismissed = true;
		// The button that had focus is gone with the card.
		document.getElementById('main-content')?.focus();
	}
</script>

{#if visible}
	<section
		data-testid="source-prompt"
		aria-labelledby={answered ? undefined : 'source-prompt-title'}
		class="surface-card p-4"
	>
		{#if answered}
			<p
				bind:this={thanksRef}
				tabindex="-1"
				role="status"
				class="text-sm text-foreground outline-none"
			>
				Terima kasih, jawabanmu tersimpan.
			</p>
		{:else}
			<div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
				<div class="min-w-0 flex-1 basis-64">
					<h2 id="source-prompt-title" class="font-sans text-base font-semibold text-foreground">
						Dari mana kamu tahu Sakala?
					</h2>
					<p class="mt-0.5 text-sm text-muted">
						Boleh dilewati. Jawabanmu membantu kami tahu cara orang menemukan Sakala.
					</p>
				</div>
				<Button variant="ghost" size="sm" onclick={skip} disabled={sourceMutation.isPending}>
					Lewati
				</Button>
			</div>

			<div
				role="group"
				aria-labelledby="source-prompt-title"
				aria-busy={sourceMutation.isPending}
				class="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"
			>
				{#each ONBOARDING_SOURCE_VALUES as source (source)}
					<Button
						variant="secondary"
						size="sm"
						disabled={sourceMutation.isPending}
						onclick={() => answer(source)}
					>
						{#if source === 'github'}
							<SocialLogo name="github" />
						{:else}
							{@const Icon = ICONS[source]}
							<Icon size={20} class="text-primary-dark" aria-hidden="true" />
						{/if}
						{ONBOARDING_SOURCE_OPTIONS_MAP[source]}
					</Button>
				{/each}
			</div>

			{#if errorMessage}
				<p role="alert" class="mt-3 text-sm text-error-dark">{errorMessage}</p>
			{/if}
		{/if}
	</section>
{/if}

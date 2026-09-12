<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import type { OnboardingProfile } from '$lib/api/resources/onboarding';
	import {
		ONBOARDING_PROFILE_VALUES,
		ONBOARDING_PROFILE_OPTIONS_MAP
	} from '$lib/features/onboarding/constants';

	type Props = {
		displayName?: string;
		selectedRole?: OnboardingProfile;
		isPending?: boolean;
		onUpdate?: (data: { name?: string; role?: OnboardingProfile }) => void;
		onNext: () => void;
		onSkip?: () => void;
		onBack?: () => void;
	};

	let {
		displayName = '',
		selectedRole = 'developer',
		isPending = false,
		onUpdate,
		onNext,
		onSkip,
		onBack
	}: Props = $props();

	let localRole = $state<OnboardingProfile | undefined>(undefined);
	let localName = $state<string | undefined>(undefined);

	let currentRole = $derived(localRole ?? selectedRole);
	let currentName = $derived(localName ?? displayName);

	function selectRole(role: OnboardingProfile) {
		localRole = role;
		onUpdate?.({ name: currentName, role });
	}

	function handleInput(e: Event) {
		localName = (e.target as HTMLInputElement).value;
		onUpdate?.({ name: localName, role: currentRole });
	}

	const roles: { id: OnboardingProfile; label: string }[] = ONBOARDING_PROFILE_VALUES.map((id) => ({
		id,
		label: ONBOARDING_PROFILE_OPTIONS_MAP[id]
	}));
</script>

<div class="mx-auto w-full py-12 px-6 md:px-60">
	<!-- Header Section -->
	<div>
		<!-- Badge -->
		<div class="mb-10">
			<span
				class="inline-block rounded-lg border border-primary/40 bg-primary-50/50 px-3 py-1 font-mono text-[14px] text-primary"
			>
				Langkah 2 dari 3
			</span>
		</div>

		<!-- Heading -->
		<h1 class="text-3xl font-bold tracking-tight text-black sm:text-4xl">Pengaturan Profil</h1>
		<p class="mt-2 text-sm text-black">
			Lengkapi identitas teknis Anda untuk mempersonalisasi pengalaman dokumentasi dan kolaborasi di
			Sakala.
		</p>
	</div>

	<!-- Form & Role Cards Section -->
	<div class="mt-20">
		<!-- Nama Tampilan -->
		<div>
			<label for="display-name" class="block font-sans text-[25px] font-semibold text-black">
				Nama Tampilan
			</label>
			<input
				id="display-name"
				type="text"
				placeholder="Misal: sakala_programmer"
				value={currentName}
				oninput={handleInput}
				disabled={isPending}
				class="mt-2 h-14 w-full rounded-lg border border-border/60 bg-surface pl-10 pr-4 py-3 font-sans text-[18px] font-normal text-black placeholder:text-muted focus:border-primary focus:outline-none disabled:opacity-60"
			/>
		</div>

		<!-- Peran Utama -->
		<div class="mt-12">
			<h2 class="font-sans text-[25px] font-semibold text-black">Peran Utama</h2>

			<!-- 4 Cards -->
			<div class="mt-2 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
				{#each roles as role (role.id)}
					{@const isSelected = currentRole === role.id}
					<button
						type="button"
						onclick={() => selectRole(role.id)}
						disabled={isPending}
						class={cn(
							'flex h-30 w-full items-center justify-center rounded-lg border text-center transition-all sm:w-[220.5px] disabled:opacity-60',
							isSelected
								? 'border-primary bg-primary text-white'
								: 'border-border-strong bg-surface text-black hover:border-primary/40'
						)}
					>
						<span class="font-sans text-[22px] font-medium">{role.label}</span>
					</button>
				{/each}
			</div>
		</div>
	</div>

	<!-- Footer Navigation Controls -->
	<div class="mt-20 flex items-center justify-between pt-6">
		<button
			type="button"
			onclick={onBack}
			disabled={!onBack || isPending}
			class="flex h-11.75 w-40.5 items-center justify-center rounded-lg border border-border bg-white text-[22px] font-medium text-black transition-colors hover:bg-background disabled:opacity-30"
		>
			Kembali
		</button>

		<div class="flex items-center gap-2">
			<button
				type="button"
				onclick={onSkip ?? onNext}
				disabled={isPending}
				class="flex h-11.75 w-40.5 items-center justify-center rounded-lg border border-border bg-white text-[22px] font-medium text-black transition-colors hover:bg-background disabled:opacity-30"
			>
				Lewati
			</button>

			<button
				type="button"
				onclick={onNext}
				disabled={isPending}
				class="flex h-11.75 w-40.5 items-center justify-center rounded-lg bg-primary text-[22px] font-normal text-white transition-colors hover:bg-primary-dark hover:text-white disabled:opacity-60"
			>
				Lanjutkan
			</button>
		</div>
	</div>
</div>

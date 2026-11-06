<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import type { OnboardingProfile } from '$lib/api/resources/onboarding';
	import {
		ONBOARDING_PROFILE_VALUES,
		ONBOARDING_PROFILE_OPTIONS_MAP
	} from '$lib/features/onboarding/constants';
	import OnboardingError from './OnboardingError.svelte';
	import OnboardingShell from './OnboardingShell.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import FormField from '$lib/components/ui/FormField.svelte';

	type Props = {
		displayName?: string;
		selectedRole?: OnboardingProfile;
		isSubmitPending: boolean;
		isSkipPending: boolean;
		errorMessage?: string | null;
		onUpdate: (data: { name?: string; role?: OnboardingProfile }) => void;
		onNext: () => void;
		onSkip: () => void;
	};

	let {
		displayName = '',
		selectedRole,
		isSubmitPending,
		isSkipPending,
		errorMessage,
		onUpdate,
		onNext,
		onSkip
	}: Props = $props();

	const isBusy = $derived(isSubmitPending || isSkipPending);
</script>

<OnboardingShell
	step={1}
	title="Profil kamu"
	description="Nama muncul di akunmu. Peran membantu kami memahami siapa yang memakai Sakala."
>
	{#if errorMessage}
		<OnboardingError title="Gagal menyimpan profil." description={errorMessage} />
	{/if}

	<FormField
		id="display-name"
		label="Nama lengkap"
		autocomplete="name"
		placeholder="Rani Wulandari"
		disabled={isBusy}
		bind:value={() => displayName, (name) => onUpdate({ name, role: selectedRole })}
	/>

	<fieldset>
		<legend class="text-sm font-medium text-foreground">Peran utama</legend>
		<div class="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
			{#each ONBOARDING_PROFILE_VALUES as role (role)}
				{@const isSelected = selectedRole === role}
				<label
					class={cn(
						'flex min-h-14 cursor-pointer items-center justify-center rounded-control border px-2 text-center text-sm font-medium transition-colors focus-within:outline-3 focus-within:outline-offset-1 focus-within:outline-primary',
						isSelected
							? 'border-primary bg-primary text-white'
							: 'border-border-strong bg-surface text-foreground hover:border-primary'
					)}
				>
					<input
						type="radio"
						name="onboarding-role"
						value={role}
						checked={isSelected}
						disabled={isBusy}
						onchange={() => onUpdate({ name: displayName, role })}
						class="sr-only"
					/>
					{ONBOARDING_PROFILE_OPTIONS_MAP[role]}
				</label>
			{/each}
		</div>
	</fieldset>

	{#snippet footer()}
		<Button variant="ghost" class="ml-auto" onclick={onSkip} disabled={isBusy}>
			{isSkipPending ? 'Melewati...' : 'Lewati'}
		</Button>
		<Button onclick={onNext} disabled={!displayName?.trim() || !selectedRole || isBusy}>
			{isSubmitPending ? 'Menyimpan...' : 'Lanjutkan'}
		</Button>
	{/snippet}
</OnboardingShell>

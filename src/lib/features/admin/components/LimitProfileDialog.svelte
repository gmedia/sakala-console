<script lang="ts">
	// The create link is resolve() output plus a query string, which the rule cannot follow.
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { resolve } from '$app/paths';
	import type { LimitProfile } from '$lib/api/resources/admin/accounts';
	import Button from '$lib/components/ui/Button.svelte';
	import { buttonClasses } from '$lib/components/ui/button-classes';
	import ReasonDialog from './ReasonDialog.svelte';
	import { formatNumber } from '../format';
	import { profileReturnPath, type ProfileReturnTarget } from '../return-to';

	type KeyLimits = Pick<
		LimitProfile,
		'max_projects' | 'max_active_containers' | 'max_active_deployments'
	>;

	type Props = {
		open: boolean;
		id: string;
		subject: string;
		consequence: string;
		/** "Default tim" or "Default pribadi": what an empty choice falls back to. */
		defaultLabel: string;
		/** The default's numbers, when known (only while the target is on the default). */
		defaultLimits?: KeyLimits | null;
		/** The profile in force now; null means the default. */
		currentProfileId: string | null;
		/** Preselected on open, for example a profile just created for this target. */
		initialProfileId?: string | null;
		profiles: LimitProfile[] | undefined;
		profilesLoading: boolean;
		profilesError: boolean;
		onRetryProfiles: () => void;
		/** The page to come back to after creating a profile from the empty state. */
		returnTo: ProfileReturnTarget;
		error?: unknown;
		onCancel: () => void;
		onConfirm: (profileId: string | null, reason: string) => Promise<unknown>;
	};

	let {
		open,
		id,
		subject,
		consequence,
		defaultLabel,
		defaultLimits = null,
		currentProfileId,
		initialProfileId = null,
		profiles,
		profilesLoading,
		profilesError,
		onRetryProfiles,
		returnTo,
		error = null,
		onCancel,
		onConfirm
	}: Props = $props();

	let selected = $state('');

	$effect.pre(() => {
		if (open) selected = initialProfileId ?? currentProfileId ?? '';
	});

	const current = $derived(currentProfileId ?? '');
	const noProfiles = $derived(!profilesLoading && !profilesError && profiles?.length === 0);
	const unchanged = $derived(selected === current);
	const createHref = $derived(
		`${resolve('/admin/limit-profiles')}?create=1&return_to=${encodeURIComponent(profileReturnPath(returnTo))}`
	);

	function keyLimits(limits: KeyLimits): string {
		return `${formatNumber(limits.max_projects)} proyek, ${formatNumber(limits.max_active_containers)} container berjalan, ${formatNumber(limits.max_active_deployments)} deployment berjalan`;
	}

	const selectedProfile = $derived(profiles?.find((profile) => profile.id === selected));
	const summary = $derived(
		selectedProfile
			? `${selectedProfile.name}: ${keyLimits(selectedProfile)}. Per proyek memori ${formatNumber(selectedProfile.max_memory_mb)} MB dan CPU ${formatNumber(selectedProfile.max_cpu_millis)} millicore.`
			: defaultLimits
				? `${defaultLabel}: ${keyLimits(defaultLimits)}, sesuai konfigurasi server.`
				: `${defaultLabel}: batas bawaan dari konfigurasi server.`
	);

	const fieldsProblem = $derived(
		profilesLoading
			? 'Tunggu daftar profil batas selesai dimuat.'
			: profilesError
				? 'Daftar profil batas gagal dimuat. Pilih Coba lagi di atas.'
				: unchanged
					? 'Pilih profil yang berbeda dari yang sedang dipakai.'
					: null
	);
</script>

<ReasonDialog
	{open}
	{id}
	title="Ubah profil batas"
	{subject}
	consequence={noProfiles ? `Sekarang memakai ${defaultLabel}.` : consequence}
	confirmLabel="Simpan profil"
	{error}
	{fieldsProblem}
	unavailable={noProfiles ? emptyState : undefined}
	{onCancel}
	onConfirm={(reason) => onConfirm(selected || null, reason)}
>
	{#snippet fields({ showErrors })}
		<div class="space-y-1.5">
			<label for={`${id}-select`} class="block text-sm font-medium">Profil batas</label>
			{#if profilesError}
				<div
					class="flex flex-wrap items-center justify-between gap-2 rounded-control border border-error/20 bg-error/10 px-3 py-2"
				>
					<p class="text-sm text-error" role="alert">Daftar profil batas gagal dimuat.</p>
					<Button size="sm" variant="secondary" onclick={onRetryProfiles}>Coba lagi</Button>
				</div>
			{/if}
			<select
				id={`${id}-select`}
				class="control-input cursor-pointer"
				bind:value={selected}
				disabled={profilesLoading || profilesError}
				aria-invalid={showErrors && fieldsProblem ? 'true' : undefined}
				aria-describedby={`${id}-select-hint`}
			>
				<option value="">{defaultLabel}</option>
				{#each profiles ?? [] as profile (profile.id)}
					<option value={profile.id}>{profile.name} ({keyLimits(profile)})</option>
				{/each}
			</select>
			<div id={`${id}-select-hint`} class="space-y-1 text-xs text-foreground/70">
				{#if profilesLoading}
					<p role="status">Memuat daftar profil batas...</p>
				{:else if !profilesError}
					<p>{summary}</p>
					{#if unchanged}
						<p class={showErrors ? 'text-error-base' : ''}>
							Ini profil yang sedang dipakai, jadi menyimpannya tidak mengubah apa pun.
						</p>
					{/if}
					<p>
						Butuh paket lain? <a
							href={createHref}
							class="inline-flex min-h-6 items-center font-medium text-primary-dark underline underline-offset-2"
							>Buat profil batas baru</a
						>
					</p>
				{/if}
			</div>
		</div>
	{/snippet}
</ReasonDialog>

{#snippet emptyState()}
	<div class="rounded-card border border-border bg-background px-4 py-4">
		<h3 class="text-base font-semibold text-foreground">Belum ada profil batas</h3>
		<p class="mt-1 text-sm text-foreground">
			Profil batas adalah paket batas, misalnya Pilot atau Kelas, yang dibuat dulu di halaman Profil
			batas. Setelah profilnya dibuat, kamu dibawa kembali ke sini untuk memasangnya.
		</p>
		<a href={createHref} class={buttonClasses('primary', 'md', 'mt-4 w-full sm:w-auto')}>
			Buat profil batas
		</a>
	</div>
{/snippet}

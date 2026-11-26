<script lang="ts">
	// Links here are resolve() output, some with a query string added, which the rule cannot follow.
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { tick } from 'svelte';
	import { resolve } from '$app/paths';
	import { beforeNavigate, goto } from '$app/navigation';
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import LearnMore from '$lib/components/ui/LearnMore.svelte';
	import FormPageLayout from '$lib/components/layout/templates/FormPageLayout.svelte';
	import PanelNextSteps from '$lib/components/panel/PanelNextSteps.svelte';
	import PanelHelp from '$lib/components/panel/PanelHelp.svelte';
	import { WORKSPACE_LIMITS_GUIDE_URL } from '$lib/config/project';
	import { ADMIN_PANEL_COPY } from '../../panel';
	import { ApiError, getErrorMessage, getFieldError } from '$lib/api/errors';
	import AdminPageHeader from '../AdminPageHeader.svelte';
	import AdminError from '../AdminError.svelte';
	import { createAdminWorkspaceQuery, createLimitProfileQuery } from '../../queries';
	import { createSaveLimitProfileMutation } from '../../mutations';
	import { formatNumber } from '../../format';
	import { ASSIGN_PROFILE_PARAM, parseProfileReturn, RETURN_TO_PARAM } from '../../return-to';
	import { profilePrefill, type ProfilePrefill } from '../../profile-defaults';
	import { createRegionsQuery } from '$lib/features/databases/queries';
	import {
		ANY_REGION,
		emptyProfileValues,
		hasOptionalValue,
		invalidProfileLabels,
		OPTIONAL_EMPTY_RULE,
		REGION_HINT,
		PROFILE_GROUPS,
		PROFILE_NUMBER_FIELDS,
		profileFieldProblem,
		profilePayload,
		profileValuesFrom,
		rawProfileValue,
		regionOptions,
		type ProfileFieldGroup,
		type ProfileNumberValues
	} from '../../limit-profile-form';
	import { REASON_HINT, REASON_MAX, reasonProblem } from '../../reason';

	const UNSAVED_CHANGES_PROMPT =
		'Perubahan di profil ini belum disimpan. Tinggalkan halaman ini dan buang perubahannya?';

	/** Null creates a profile; an id edits that one. */
	let { profileId }: { profileId: string | null } = $props();

	const uid = $props.id();
	const isNew = $derived(profileId === null);
	const listHref = resolve('/admin/limit-profiles');

	const profileQuery = createLimitProfileQuery(
		() => profileId ?? '',
		() => profileId !== null
	);
	const saveMutation = createSaveLimitProfileMutation();

	// Opened from an assign dialog: once the profile exists, go back to that workspace or user with
	// the new profile chosen.
	const returnTarget = $derived(
		isNew ? parseProfileReturn(page.url.searchParams.get(RETURN_TO_PARAM)) : null
	);
	// The workspace a profile is being made for reports the live team default in its quota.
	const returnWorkspace = createAdminWorkspaceQuery(
		() => (returnTarget?.kind === 'workspaces' ? returnTarget.id : ''),
		() => returnTarget?.kind === 'workspaces'
	);

	let name = $state('');
	let values = $state<ProfileNumberValues>(emptyProfileValues());
	let reason = $state('');
	let region = $state(ANY_REGION);
	const regionsQuery = createRegionsQuery();
	const regions = $derived(regionOptions(regionsQuery.data ?? [], region));
	/** Which numbers a new profile started from, said in the form so nobody takes them for a rule. */
	let prefill = $state<ProfilePrefill['source'] | null>(null);
	/** Null until someone opens or closes Opsional; until then it is open when it holds a value. */
	let optionalOpen = $state<boolean | null>(null);
	let attempted = $state(false);
	let saveError = $state<unknown>(null);
	let loaded = false;
	let numbersEdited = false;
	let submitting = false;

	let nameInput = $state<HTMLInputElement | null>(null);
	let formEl = $state<HTMLFormElement | null>(null);

	function applyPrefill(next: ProfilePrefill) {
		for (const [key, value] of Object.entries(next.numbers)) {
			values[key as keyof ProfileNumberValues] = String(value);
		}
		prefill = next.source;
	}

	// Fill the form once: from the profile when editing, from the team default when creating.
	$effect(() => {
		if (loaded) return;
		if (isNew) {
			applyPrefill(profilePrefill(returnWorkspace.data));
		} else if (profileQuery.data) {
			name = profileQuery.data.name;
			values = profileValuesFrom(profileQuery.data);
			region = profileQuery.data.default_region ?? ANY_REGION;
		} else {
			return;
		}
		loaded = true;
		baseline = snapshot();
		// Start where the form starts, not at the reason at its end.
		void tick().then(() => nameInput?.focus());
	});

	// The live default may arrive after the form opened; take it while no number was changed.
	$effect(() => {
		const live = profilePrefill(returnWorkspace.data);
		if (isNew && prefill === 'documented' && live.source === 'workspace' && !numbersEdited) {
			applyPrefill(live);
			baseline = snapshot();
		}
	});

	/** What the form holds, normalized, to compare with what it opened with. */
	const snapshot = () => JSON.stringify([profilePayload(name, values, region), reason.trim()]);
	/** Set once the form is filled; empty until then, so loading never counts as a change. */
	let baseline = $state('');
	/** Set after a save, so going back to the list does not ask about what was just saved. */
	let leavingAfterSave = false;
	const dirty = $derived(baseline !== '' && snapshot() !== baseline);

	// Leaving with unsaved numbers loses them. Closing the tab or reloading gets the browser's own
	// prompt (cancelling a `leave` navigation asks for it); a link inside the Console asks here.
	beforeNavigate((navigation) => {
		if (!dirty || leavingAfterSave) return;
		if (navigation.type === 'leave') {
			navigation.cancel();
			return;
		}
		if (!confirm(UNSAVED_CHANGES_PROMPT)) navigation.cancel();
	});

	const fieldError = (key: string) => getFieldError(saveError, key);
	const nameProblem = $derived(name.trim() ? null : 'Nama belum diisi.');
	const nameError = $derived(fieldError('name') ?? (attempted ? nameProblem : null));
	const invalidLabels = $derived(invalidProfileLabels(name, values));
	const optionalHasError = $derived(
		PROFILE_NUMBER_FIELDS.some(
			(field) =>
				field.group === 'optional' &&
				(Boolean(fieldError(field.key)) ||
					(rawProfileValue(values, field.key) !== '' && profileFieldProblem(field, values)))
		)
	);
	const optionalVisible = $derived(
		optionalHasError ||
			Boolean(fieldError('default_region')) ||
			(optionalOpen ?? hasOptionalValue(values, region))
	);

	const reasonTooLong = $derived(reason.length > REASON_MAX);
	const currentReasonProblem = $derived(reasonProblem(reason));
	const reasonError = $derived(
		(reasonTooLong || attempted ? currentReasonProblem : null) ?? fieldError('reason')
	);
	// The button stays enabled (a disabled one cannot say why); this says why it stopped.
	const blockedText = $derived.by(() => {
		if (!attempted) return null;
		const sentences = [
			invalidLabels.length ? `Periksa isian yang ditandai: ${invalidLabels.join(', ')}.` : null,
			currentReasonProblem ? (reasonTooLong ? 'Pendekkan alasannya.' : 'Isi alasan dulu.') : null
		].filter(Boolean);
		return sentences.length ? `Belum bisa disimpan. ${sentences.join(' ')}` : null;
	});
	const generalError = $derived(
		saveError &&
			!(
				saveError instanceof ApiError &&
				saveError.isValidationError &&
				Object.keys(saveError.errors).length
			)
			? getErrorMessage(saveError, 'Profil belum tersimpan. Coba lagi.')
			: null
	);

	const title = $derived(isNew ? 'Buat profil batas' : 'Ubah profil batas');
	const consequence = $derived(
		!isNew
			? 'Batas baru langsung berlaku untuk semua workspace yang memakai profil ini. Yang sudah terlewati tidak dibatalkan.'
			: returnTarget
				? `Setelah dibuat, kamu kembali ke ${returnTarget.kind === 'workspaces' ? 'workspace' : 'pengguna'} tadi untuk memasangnya.`
				: undefined
	);
	// Where to look next while editing: the workspaces the change reaches.
	const steps = $derived(
		!isNew && profileId
			? [
					{
						id: 'workspaces',
						label: 'Lihat workspace pemakai',
						href: `${resolve('/admin/workspaces')}?${new URLSearchParams({ limit_profile_id: profileId })}`
					}
				]
			: []
	);
	const helpLinks = [{ label: 'Batas pilot', href: WORKSPACE_LIMITS_GUIDE_URL }];
	const backHref = $derived(
		returnTarget
			? returnTarget.kind === 'workspaces'
				? resolve(`/admin/workspaces/${returnTarget.id}`)
				: resolve(`/admin/users/${returnTarget.id}`)
			: listHref
	);

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (submitting) return;
		attempted = true;
		saveError = null;
		if (invalidLabels.length || currentReasonProblem) {
			await tick();
			formEl?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
			return;
		}

		submitting = true;
		const fields = profilePayload(name, values, region);
		try {
			const saved = await saveMutation.mutateAsync({
				id: profileId,
				fields,
				reason: reason.trim()
			});
			leavingAfterSave = true;
			if (returnTarget) {
				toast.success(`Profil ${fields.name} dibuat. Tulis alasan lalu simpan untuk memasangnya.`);
				await goto(`${backHref}?${ASSIGN_PROFILE_PARAM}=${encodeURIComponent(saved.id)}`);
				return;
			}
			toast.success(isNew ? `Profil ${fields.name} dibuat.` : `Profil ${fields.name} diperbarui.`);
			await goto(listHref);
		} catch (error) {
			saveError = error;
			await tick();
			formEl?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
		} finally {
			submitting = false;
		}
	}

	/** Numbers side by side: each input is narrow, and one per row made the page twice as tall. */
	const FIELD_GRID = 'grid gap-5 @lg:grid-cols-2 @2xl:grid-cols-3';

	const groupFields = (group: ProfileFieldGroup) =>
		PROFILE_NUMBER_FIELDS.filter((field) => field.group === group);
</script>

{#snippet numberField(field: (typeof PROFILE_NUMBER_FIELDS)[number])}
	{@const problem =
		rawProfileValue(values, field.key) || attempted ? profileFieldProblem(field, values) : null}
	{@const message = fieldError(field.key) ?? problem}
	<div class="space-y-1.5">
		<label for={`profile-${field.key}`} class="block text-sm font-medium">
			{field.label}
			<span class="font-normal text-foreground/70">{field.optional ? '(opsional)' : '(wajib)'}</span
			>
		</label>
		<input
			id={`profile-${field.key}`}
			type="number"
			inputmode="numeric"
			min={field.min}
			max={field.max}
			class="control-input tabular-nums"
			bind:value={values[field.key]}
			required={!field.optional}
			oninput={() => {
				numbersEdited = true;
				// Emptying the last optional value must not fold the group away under the cursor.
				if (field.optional) optionalOpen = true;
			}}
			aria-invalid={message ? 'true' : undefined}
			aria-describedby={`profile-${field.key}-hint`}
		/>
		<p
			id={`profile-${field.key}-hint`}
			class="text-xs {message ? 'text-error-base' : 'text-foreground/70'}"
		>
			{message ?? field.short ?? field.hint}
		</p>
	</div>
{/snippet}

{#snippet regionField()}
	{@const message = fieldError('default_region')}
	<div class="space-y-1.5">
		<label for="profile-default_region" class="block text-sm font-medium">
			Region bawaan <span class="font-normal text-foreground/70">(opsional)</span>
		</label>
		<!-- Only regions the API reports, so nothing the placement could never honour is offered. -->
		<select
			id="profile-default_region"
			class="control-input"
			bind:value={region}
			onchange={() => (optionalOpen = true)}
			aria-invalid={message ? 'true' : undefined}
			aria-describedby="profile-default_region-hint"
		>
			<option value={ANY_REGION}>Semua region</option>
			{#each regions as slug (slug)}
				<option value={slug}>{slug}</option>
			{/each}
		</select>
		<p
			id="profile-default_region-hint"
			class="text-xs {message ? 'text-error-base' : 'text-foreground/70'}"
		>
			{#if message}
				{message}
			{:else if regionsQuery.isError}
				Daftar region belum bisa dimuat, jadi hanya region yang sudah tersimpan yang bisa dipilih.
			{:else if (regionsQuery.data ?? []).length === 0 && !regionsQuery.isPending}
				Belum ada node yang melaporkan region, jadi proyek dan database berjalan di node mana saja.
			{:else}
				{REGION_HINT.short}
			{/if}
			{#if region && !(regionsQuery.data ?? []).includes(region) && regionsQuery.isSuccess}
				Region {region} sekarang tidak punya node aktif.
			{/if}
		</p>
	</div>
{/snippet}

<AdminPageHeader
	{title}
	documentTitle={profileQuery.data ? `${title}: ${profileQuery.data.name}` : title}
	description={consequence}
	crumbs={[
		{ label: 'Profil batas', href: listHref },
		{ label: isNew ? 'Profil baru' : (profileQuery.data?.name ?? 'Ubah') }
	]}
>
	<!-- Editing changes every workspace on the profile at once, so the page says how many. -->
	{#if !isNew && profileQuery.data}
		<Badge tone="neutral" class="whitespace-normal"
			>Profil {profileQuery.data.name}, dipakai {formatNumber(
				profileQuery.data.workspaces_count ?? 0
			)} workspace</Badge
		>
	{/if}
</AdminPageHeader>

{#if !isNew && profileQuery.isError}
	<AdminError
		error={profileQuery.error}
		what="profil batas"
		onRetry={() => profileQuery.refetch()}
	/>
{:else if !isNew && !profileQuery.data}
	<div class="max-w-reading space-y-4" role="status" aria-label="Memuat profil batas">
		<div class="skeleton h-16 w-full"></div>
		<div class="skeleton h-64 w-full"></div>
	</div>
{:else}
	{#snippet panel()}
		<PanelNextSteps {steps} />
		<PanelHelp links={helpLinks} />
	{/snippet}

	<FormPageLayout panelLabel={ADMIN_PANEL_COPY.label} {panel}>
		<form
			bind:this={formEl}
			class="flex flex-col gap-6"
			novalidate
			aria-label={title}
			onsubmit={handleSubmit}
		>
			<div class="space-y-1.5">
				<label for="profile-name" class="block text-sm font-medium">
					Nama <span class="font-normal text-foreground/70">(wajib)</span>
				</label>
				<input
					id="profile-name"
					bind:this={nameInput}
					class="control-input"
					bind:value={name}
					maxlength="100"
					autocomplete="off"
					aria-invalid={nameError ? 'true' : undefined}
					aria-describedby="profile-name-hint"
				/>
				<p
					id="profile-name-hint"
					class="text-xs {nameError ? 'text-error-base' : 'text-foreground/70'}"
				>
					{nameError ?? 'Unik. Contoh: Pilot, Kelas, atau Magang.'}
				</p>
			</div>

			{#if prefill}
				<p class="rounded-control border border-border bg-surface px-3 py-2 text-sm">
					{prefill === 'workspace'
						? 'Diisi dengan batas Default tim yang berlaku di workspace tadi.'
						: 'Diisi dengan batas default tim bawaan Sakala; server bisa memakai angka lain.'}
				</p>
			{/if}

			{#each PROFILE_GROUPS as group (group.id)}
				<section
					aria-labelledby="{uid}-{group.id}"
					class="surface-card @container flex flex-col gap-5 p-4 sm:p-6"
					data-testid="profile-group-{group.id}"
				>
					{#if group.id === 'optional'}
						<div>
							<h2 id="{uid}-{group.id}" class="font-sans text-base font-semibold text-foreground">
								<button
									type="button"
									class="flex min-h-control-lg w-full cursor-pointer items-center justify-between gap-2 rounded-control text-left lg:min-h-control-md"
									aria-expanded={optionalVisible}
									aria-controls="{uid}-{group.id}-fields"
									onclick={() => (optionalOpen = !optionalVisible)}
								>
									<span>{group.title}</span>
									<CaretDown
										size={16}
										class={optionalVisible ? 'shrink-0 rotate-180' : 'shrink-0'}
										aria-hidden="true"
									/>
								</button>
							</h2>
							<p class="text-sm text-foreground/70">{group.lead}</p>
						</div>
						<div id="{uid}-{group.id}-fields" class="flex flex-col gap-5" hidden={!optionalVisible}>
							<p class="text-sm text-foreground/70">{OPTIONAL_EMPTY_RULE}</p>
							<div class={FIELD_GRID}>
								{#each groupFields(group.id) as field (field.key)}
									{@render numberField(field)}
								{/each}
								{@render regionField()}
							</div>
							<LearnMore topic="isian opsional" testid="profile-optional-learn">
								<dl class="flex flex-col gap-2">
									{#each groupFields(group.id) as field (field.key)}
										<div>
											<dt class="font-medium">{field.label}</dt>
											<dd>{field.hint}</dd>
										</div>
									{/each}
									<div>
										<dt class="font-medium">Region bawaan</dt>
										<dd>{REGION_HINT.full}</dd>
									</div>
								</dl>
							</LearnMore>
						</div>
					{:else}
						<div>
							<h2 id="{uid}-{group.id}" class="font-sans text-base font-semibold text-foreground">
								{group.title}
							</h2>
							<p class="mt-1 text-sm text-foreground/70">{group.lead}</p>
						</div>
						<div class={FIELD_GRID}>
							{#each groupFields(group.id) as field (field.key)}
								{@render numberField(field)}
							{/each}
						</div>
					{/if}
				</section>
			{/each}

			<div class="space-y-1.5">
				<label for="{uid}-reason" class="block text-sm font-medium text-foreground">
					Alasan <span class="font-normal text-foreground/70">(wajib)</span>
				</label>
				<p id="{uid}-reason-help" class="text-xs text-foreground/70">{REASON_HINT}</p>
				<textarea
					id="{uid}-reason"
					bind:value={reason}
					rows="3"
					required
					aria-invalid={reasonError ? 'true' : undefined}
					aria-describedby="{uid}-reason-help {uid}-reason-status"
					class="control-input resize-y"></textarea>
				<p id="{uid}-reason-status" class="flex justify-between gap-3 text-xs">
					<span class="text-error-base">{reasonError ?? ''}</span>
					<span class="shrink-0 {reasonTooLong ? 'text-error-base' : 'text-muted'}"
						>{reason.length}/{REASON_MAX}</span
					>
				</p>
			</div>

			<!-- Stays in view while the form scrolls, so the way out and the way forward are always there. -->
			<div
				class="sticky bottom-0 -mx-1 flex flex-col gap-3 border-t border-border bg-background px-1 py-4"
				data-testid="profile-form-footer"
			>
				{#if blockedText}
					<p
						id="{uid}-blocked"
						class="rounded-control border border-error/20 bg-error/10 px-3 py-2 text-sm text-error"
						role="alert"
					>
						{blockedText}
					</p>
				{/if}
				{#if generalError}
					<p
						class="rounded-control border border-error/20 bg-error/10 px-3 py-2 text-sm text-error"
						role="alert"
					>
						{generalError}
					</p>
				{/if}
				<div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
					<Button href={backHref} variant="secondary">Batal</Button>
					<Button
						type="submit"
						disabled={saveMutation.isPending}
						aria-busy={saveMutation.isPending}
						aria-describedby={blockedText ? `${uid}-blocked` : undefined}
					>
						{#if saveMutation.isPending}
							Menyimpan...
						{:else}
							{isNew ? 'Buat profil' : 'Simpan perubahan'}
						{/if}
					</Button>
				</div>
			</div>
		</form>
	</FormPageLayout>
{/if}

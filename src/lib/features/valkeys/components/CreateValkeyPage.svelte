<script lang="ts">
	// Links carry the workspace or project in the query string, which resolve() cannot express.
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft';
	import CircleNotch from 'phosphor-svelte/lib/CircleNotch';
	import Memory from 'phosphor-svelte/lib/Memory';
	import { toast } from 'svelte-sonner';
	import { getFieldError } from '$lib/api/errors';
	import type { ValkeyMode } from '$lib/api/resources/valkeys';
	import EmptyState from '$lib/components/feedback/EmptyState.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { buttonClasses } from '$lib/components/ui/button-classes';
	import FormField from '$lib/components/ui/FormField.svelte';
	import LearnMore from '$lib/components/ui/LearnMore.svelte';
	import FocusedPageLayout from '$lib/components/layout/templates/FocusedPageLayout.svelte';
	import { useCurrentUser } from '$lib/features/auth/queries';
	import { isAdmin } from '$lib/features/admin/access';
	import { createRegionsQuery } from '$lib/features/databases/queries';
	import {
		regionAutoHint,
		regionAutoLabel,
		workspacePhrase
	} from '$lib/features/databases/presentation';
	import { createProjectQuery } from '$lib/features/projects/queries';
	import { useActiveWorkspace } from '$lib/features/workspaces/access.svelte';
	import { limitsWorkspaceId } from '$lib/features/workspaces/presentation';
	import { createWorkspaceLimitsQuery } from '$lib/features/workspaces/queries';
	import { valkeyAccess } from '../access';
	import { createCreateValkeyMutation } from '../mutations';
	import {
		RECOMMENDED_VALKEY_MODE,
		QUOTA_COPY,
		VALKEY_COPY,
		VALKEY_NAME_MAX_LENGTH,
		defaultValkeySize,
		formatMegabytes,
		sizeOptions,
		valkeyErrorMessage,
		valkeyQuota,
		valkeySizes,
		valkeysEnabled,
		valkeysUnavailable
	} from '../presentation';
	import { VALKEY_PROJECT_PARAM, valkeyHref, valkeysHref } from '../routes';
	import ValkeyModeOptions from './ValkeyModeOptions.svelte';
	import ValkeySizeOptions from './ValkeySizeOptions.svelte';

	const AUTO = '';

	const userQuery = useCurrentUser();
	const workspaces = useActiveWorkspace();
	const active = $derived(workspaces.active);
	const siteAdmin = $derived(isAdmin(userQuery.data));
	const access = $derived(valkeyAccess(active?.role, siteAdmin));

	const limitsQuery = createWorkspaceLimitsQuery(
		() => limitsWorkspaceId(active),
		() => ({ enabled: Boolean(active) })
	);
	const limits = $derived(limitsQuery.data);
	const enabled = $derived(valkeysEnabled(limits));
	const sizes = $derived(valkeySizes(limits));
	const quota = $derived(valkeyQuota(limits?.quotas, Math.min(...sizes)));
	// Admins are not held to the workspace's count or memory; the API decides for them.
	const blockedReason = $derived(
		siteAdmin
			? null
			: valkeysUnavailable(limits)
				? `${VALKEY_COPY.unavailableTitle}. ${VALKEY_COPY.unavailableBody}`
				: (quota?.blockedReason ?? null)
	);
	const availableMb = $derived(siteAdmin ? null : (quota?.remainingMb ?? null));

	// From a project: the API places the store on the project's node and attaches it at once.
	const projectId = $derived(page.url.searchParams.get(VALKEY_PROJECT_PARAM));
	const projectQuery = createProjectQuery(() => projectId ?? '');
	const project = $derived(
		projectQuery.data && projectQuery.data.workspace?.id === active?.id ? projectQuery.data : null
	);
	const projectName = $derived(project?.name ?? project?.project_name ?? '');
	const projectValkey = $derived(project?.valkeys?.[0] ?? null);

	const regionsQuery = createRegionsQuery(() => enabled && !project);
	const regions = $derived(regionsQuery.data ?? []);

	const createMutation = createCreateValkeyMutation();

	let name = $state('');
	let mode = $state<ValkeyMode>(RECOMMENDED_VALKEY_MODE);
	let size = $state(0);
	let region = $state(AUTO);
	let nameError = $state<string | null>(null);
	let modeError = $state<string | null>(null);
	let sizeError = $state<string | null>(null);
	let formError = $state<string | null>(null);
	// `isPending` flips a tick after mutate(), too late for a double click.
	let submitting = false;

	const options = $derived(sizeOptions(sizes, availableMb));

	// The server's default size, or the largest that still fits, once the limits are known.
	let sizeApplied = false;
	$effect(() => {
		if (sizeApplied || !limits) return;
		const fitting = options.filter((option) => !option.disabled).map((option) => option.mb);
		const preferred = defaultValkeySize(limits);
		size = fitting.includes(preferred) ? preferred : (fitting.at(-1) ?? preferred);
		sizeApplied = true;
	});

	// How the size is reserved from the workspace sits behind "Pelajari" at the end of the form.
	const sizeHint = $derived(
		availableMb === null
			? 'Bisa diubah nanti.'
			: `Sisa jatah: ${formatMegabytes(availableMb)}. Bisa diubah nanti.`
	);

	const workspaceName = $derived(workspacePhrase(active));
	const backHref = $derived(valkeysHref());
	const loading = $derived(
		!workspaces.isSettled ||
			(active && limitsQuery.isPending) ||
			(projectId && projectQuery.isPending)
	);

	async function handleCreate(event: SubmitEvent) {
		event.preventDefault();
		if (submitting || blockedReason || !active) return;
		const trimmed = name.trim();
		nameError = null;
		modeError = null;
		sizeError = null;
		formError = null;
		// For a project the API names the store after it when the field is empty.
		if (!trimmed && !project) {
			nameError = 'Isi nama Valkey, misalnya nama aplikasi yang memakainya.';
			document.getElementById('valkey-name')?.focus();
			return;
		}
		if (trimmed.length > VALKEY_NAME_MAX_LENGTH) {
			nameError = `Nama Valkey paling panjang ${VALKEY_NAME_MAX_LENGTH} karakter.`;
			document.getElementById('valkey-name')?.focus();
			return;
		}

		submitting = true;
		try {
			const valkey = await createMutation.mutateAsync({
				workspaceId: active.id,
				payload: {
					name: trimmed || null,
					mode,
					maxmemory_mb: size,
					region: project || region === AUTO ? null : region,
					...(project ? { project_id: project.id } : {})
				}
			});
			toast.success(
				project
					? `Valkey ${valkey.name} sedang dibuat dan sudah dipasang ke ${projectName}.`
					: `Valkey ${valkey.name} sedang dibuat.`
			);
			await goto(valkeyHref(active.id, valkey.id));
		} catch (error) {
			nameError = getFieldError(error, 'name') ?? null;
			modeError = getFieldError(error, 'mode') ?? null;
			sizeError = getFieldError(error, 'maxmemory_mb') ?? null;
			if (!nameError && !modeError && !sizeError) {
				formError =
					getFieldError(error, 'region') ??
					getFieldError(error, 'project_id') ??
					valkeyErrorMessage(
						error,
						'create',
						'Valkey belum dibuat. Muat ulang halaman, lalu buat lagi.'
					);
			}
		} finally {
			submitting = false;
		}
	}
</script>

<!-- One form, one button: the focused template, centred. -->
<FocusedPageLayout>
	<a
		href={backHref}
		class="inline-flex min-h-control-sm w-fit items-center gap-1.5 rounded-control text-sm font-medium text-foreground/70 hover:text-foreground max-lg:min-h-control-lg"
	>
		<ArrowLeft size={16} aria-hidden="true" />
		Semua Valkey
	</a>

	{#if loading}
		<div class="skeleton h-96 w-full" role="status" aria-label="Memuat formulir Valkey"></div>
	{:else if !enabled}
		<EmptyState
			icon={Memory}
			tone="muted"
			title={VALKEY_COPY.disabledTitle}
			description={VALKEY_COPY.disabledBody}
		/>
	{:else if !access.canManage}
		<EmptyState
			icon={Memory}
			tone="muted"
			title="Kamu belum bisa membuat Valkey"
			description="Hanya pemilik dan anggota workspace yang bisa membuat Valkey."
		/>
	{:else if blockedReason}
		<div class="flex flex-col gap-3" data-testid="create-valkey-blocked">
			<EmptyState
				icon={Memory}
				tone="muted"
				title={quota?.count.max === 0 ? VALKEY_COPY.noQuota : 'Valkey baru belum bisa dibuat'}
				description={quota?.count.max === 0 ? VALKEY_COPY.noQuotaBody : blockedReason}
			/>
		</div>
	{:else if projectValkey}
		<EmptyState
			icon={Memory}
			tone="muted"
			title={`${projectName} sudah memakai Valkey`}
			description={`Proyek ini sudah memakai Valkey ${projectValkey.name}. Satu proyek memakai satu Valkey; lepas dulu dari tab Variabel proyeknya kalau mau menggantinya.`}
		/>
	{:else}
		<section
			class="surface-card flex flex-col gap-5 p-4 sm:p-6"
			aria-labelledby="create-valkey-title"
			data-testid="create-valkey-form"
		>
			<div class="flex flex-col gap-1">
				<h2 id="create-valkey-title" class="font-display text-xl font-semibold text-foreground">
					{project ? VALKEY_COPY.createForProject : VALKEY_COPY.create}
				</h2>
				<p class="text-sm text-foreground/70">{VALKEY_COPY.createLead}</p>
			</div>

			{#if project}
				<p
					class="rounded-control border border-primary/30 bg-primary-50 px-4 py-3 text-sm text-foreground"
					data-testid="create-valkey-project"
				>
					Langsung dipasang ke <span class="font-medium wrap-anywhere">{projectName}</span>, di
					server tempat proyek itu berjalan. Aplikasinya menerima
					<code class="font-mono text-xs">REDIS_URL</code> dan variabel REDIS_* lainnya setelah Valkey
					siap dan proyeknya di-redeploy.
				</p>
			{/if}

			<form class="flex flex-col gap-5" novalidate onsubmit={handleCreate}>
				<FormField
					id="valkey-name"
					label={project ? 'Nama Valkey (opsional)' : 'Nama Valkey'}
					bind:value={name}
					placeholder={project ? projectName : 'antrean-toko'}
					hint={project
						? `Kosongkan untuk memakai nama proyek. ${VALKEY_COPY.nameHint}`
						: VALKEY_COPY.nameHint}
					error={nameError}
					autocomplete="off"
					spellcheck={false}
					required={!project}
					oninput={() => (nameError = null)}
				/>

				<ValkeyModeOptions bind:value={mode} error={modeError} />

				<ValkeySizeOptions bind:value={size} {options} hint={sizeHint} error={sizeError} />

				{#if !project && regions.length > 0}
					<div class="flex flex-col gap-1.5">
						<label for="valkey-region" class="text-sm font-medium text-foreground">Region</label>
						<select
							id="valkey-region"
							bind:value={region}
							class="control-input"
							aria-describedby="valkey-region-hint"
						>
							<option value={AUTO}>{regionAutoLabel(active?.default_region ?? null)}</option>
							{#each regions as slug (slug)}
								<option value={slug}>{slug}</option>
							{/each}
						</select>
						<p id="valkey-region-hint" class="text-xs text-foreground/70">
							{#if region === AUTO}
								{regionAutoHint(active?.default_region ?? null)}
							{/if}
							{VALKEY_COPY.regionShortHint}
						</p>
					</div>
				{/if}

				<div class="flex flex-col gap-1">
					<p class="text-sm text-muted">
						{VALKEY_COPY.ownerLine} <span class="wrap-anywhere">{workspaceName}</span>.
					</p>
					<LearnMore topic={VALKEY_COPY.createLearnTopic}>
						<p>{VALKEY_COPY.privateNote}</p>
						<p>{VALKEY_COPY.regionHint}</p>
						<p>{QUOTA_COPY.reservedHint}</p>
					</LearnMore>
				</div>

				<div class="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-5">
					{#if formError}
						<p
							role="alert"
							class="mr-auto w-full rounded-control border border-error/20 bg-error/10 px-3 py-2 text-sm text-foreground"
							data-testid="create-valkey-error"
						>
							{formError}
						</p>
					{/if}
					<a href={backHref} class={buttonClasses('ghost', 'md', '')}>Batal</a>
					<Button
						type="submit"
						disabled={createMutation.isPending}
						aria-busy={createMutation.isPending}
						data-testid="submit-create-valkey"
					>
						{#if createMutation.isPending}
							<CircleNotch
								size={16}
								weight="bold"
								class="animate-spin motion-reduce:animate-none"
								aria-hidden="true"
							/>
						{/if}
						{createMutation.isPending ? VALKEY_COPY.creating : VALKEY_COPY.create}
					</Button>
				</div>
			</form>
		</section>
	{/if}
</FocusedPageLayout>

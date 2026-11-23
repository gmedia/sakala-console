<script lang="ts">
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { getFieldError } from '$lib/api/errors';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import FormField from '$lib/components/ui/FormField.svelte';
	import { createRegionsQuery } from '$lib/features/databases/queries';
	import { regionAutoHint, regionAutoLabel } from '$lib/features/databases/presentation';
	import { createCreateBucketMutation } from '../mutations';
	import {
		BUCKET_COPY,
		BUCKET_NAME_MAX_LENGTH,
		BUCKET_QUOTA_RANGE,
		QUOTA_COPY,
		bucketErrorMessage,
		formatMegabytes
	} from '../presentation';
	import { bucketHref } from '../routes';

	type Props = {
		open: boolean;
		workspaceId: string;
		workspaceName: string;
		/** Why the quota refuses a new bucket now; the dialog says so instead of the form. */
		blockedReason?: string | null;
		/** What the quota field starts with: the server default, capped at what is left. */
		defaultQuotaMb: number;
		/** The most MB the workspace may still reserve; `null` when the API decides (admins). */
		maxQuotaMb: number | null;
		/** The workspace's default region, which "Otomatis" resolves to; `null` for any region. */
		workspaceDefaultRegion?: string | null;
		/** Create for this project: the API attaches the bucket to it in the same step. */
		project?: { id: string; name: string; region?: string | null } | null;
	};

	let {
		open = $bindable(false),
		workspaceId,
		workspaceName,
		blockedReason = null,
		defaultQuotaMb,
		maxQuotaMb,
		workspaceDefaultRegion = null,
		project = null
	}: Props = $props();

	const AUTO = '';

	const regionsQuery = createRegionsQuery(() => open);
	const createMutation = createCreateBucketMutation();

	let name = $state('');
	let quota = $state('');
	let region = $state(AUTO);
	let nameError = $state<string | null>(null);
	let quotaError = $state<string | null>(null);
	let formError = $state<string | null>(null);
	// `isPending` flips a tick after mutate(), too late for a double click.
	let submitting = false;

	const regions = $derived(regionsQuery.data ?? []);
	const quotaMax = $derived(maxQuotaMb ?? BUCKET_QUOTA_RANGE.max);
	const quotaHintId = 'bucket-quota-hint';

	let defaultApplied = false;

	$effect(() => {
		if (!open) return;
		name = '';
		quota = String(defaultQuotaMb);
		region = AUTO;
		nameError = null;
		quotaError = null;
		formError = null;
		defaultApplied = false;
	});

	// The project's region once the list is known; the endpoint is public, so it is only a default.
	$effect(() => {
		const projectRegion = project?.region;
		if (!open || defaultApplied || !projectRegion || !regions.includes(projectRegion)) return;
		region = projectRegion;
		defaultApplied = true;
	});

	function quotaProblem(raw: string): string | null {
		const value = Number(raw.trim());
		if (!raw.trim()) return `Isi kuota dalam MB, misalnya ${defaultQuotaMb}.`;
		if (!Number.isInteger(value) || value < BUCKET_QUOTA_RANGE.min) {
			return `Isi bilangan bulat dalam MB, paling kecil ${BUCKET_QUOTA_RANGE.min}.`;
		}
		if (value > quotaMax) {
			return maxQuotaMb === null
				? `Kuota paling besar ${formatMegabytes(quotaMax)}.`
				: `Sisa jatah penyimpanan bucket workspace ini ${formatMegabytes(quotaMax)}. Isi ${quotaMax} atau kurang.`;
		}
		return null;
	}

	async function handleCreate() {
		if (submitting || blockedReason) return;
		const trimmed = name.trim();
		nameError = null;
		quotaError = null;
		formError = null;
		// For a project the API names the bucket after it when the field is empty.
		if (!trimmed && !project) {
			nameError = 'Isi nama bucket, misalnya nama aplikasi yang memakainya.';
			return;
		}
		if (trimmed.length > BUCKET_NAME_MAX_LENGTH) {
			nameError = `Nama bucket paling panjang ${BUCKET_NAME_MAX_LENGTH} karakter.`;
			return;
		}
		quotaError = quotaProblem(quota);
		if (quotaError) return;

		const base = {
			name: trimmed || null,
			region: region === AUTO ? null : region,
			quota_mb: Number(quota.trim())
		};
		submitting = true;
		try {
			const bucket = await createMutation.mutateAsync({
				workspaceId,
				payload: project ? { ...base, project_id: project.id } : base
			});
			open = false;
			toast.success(
				project
					? `Bucket ${bucket.name} sedang dibuat dan sudah dipasang ke ${project.name}.`
					: `Bucket ${bucket.name} sedang dibuat.`
			);
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved, plus a query
			await goto(bucketHref(workspaceId, bucket.id));
		} catch (error) {
			nameError = getFieldError(error, 'name') ?? null;
			quotaError = getFieldError(error, 'quota_mb') ?? null;
			if (!nameError && !quotaError) {
				formError =
					getFieldError(error, 'region') ??
					bucketErrorMessage(
						error,
						'create',
						'Bucket belum dibuat. Muat ulang halaman, lalu buat lagi.'
					);
			}
		} finally {
			submitting = false;
		}
	}
</script>

<Dialog
	bind:open
	title={project ? BUCKET_COPY.createForProject : BUCKET_COPY.create}
	descriptionClass="text-muted"
	class="max-w-lg"
	confirmLabel={createMutation.isPending ? BUCKET_COPY.creating : BUCKET_COPY.create}
	loading={createMutation.isPending}
	initialFocus={blockedReason ? 'cancel' : () => document.getElementById('bucket-name')}
	confirmDisabled={Boolean(blockedReason)}
	confirmDescribedBy={blockedReason ? 'create-bucket-blocked' : undefined}
	hideConfirm={Boolean(blockedReason)}
	cancelLabel={blockedReason ? 'Tutup' : 'Batal'}
	onConfirm={handleCreate}
>
	{#snippet description()}
		{#if project}
			Bucket privat milik <span class="font-medium wrap-anywhere text-foreground"
				>{workspaceName}</span
			>, langsung dipasang ke
			<span class="font-medium wrap-anywhere text-foreground">{project.name}</span>. Aplikasinya
			menerima variabel <code class="font-mono text-xs text-foreground">AWS_*</code> saat deploy berikutnya,
			setelah bucket siap.
		{:else}
			Bucket privat yang kompatibel dengan S3, milik
			<span class="font-medium wrap-anywhere text-foreground">{workspaceName}</span>. Setelah siap,
			pasang ke proyek, dan aplikasinya menerima variabel
			<code class="font-mono text-xs text-foreground">AWS_*</code> saat deploy berikutnya.
		{/if}
	{/snippet}

	{#if blockedReason}
		<p
			id="create-bucket-blocked"
			role="alert"
			class="rounded-control border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-foreground"
			data-testid="create-bucket-blocked"
		>
			{blockedReason}
		</p>
	{:else}
		<form
			class="flex flex-col gap-4"
			novalidate
			onsubmit={(event) => {
				event.preventDefault();
				void handleCreate();
			}}
		>
			<FormField
				id="bucket-name"
				label={project ? 'Nama bucket (opsional)' : 'Nama bucket'}
				bind:value={name}
				placeholder={project?.name ?? 'unggahan-toko'}
				hint={project
					? `Kosongkan untuk memakai nama proyek. ${BUCKET_COPY.nameHint}`
					: BUCKET_COPY.nameHint}
				error={nameError}
				autocomplete="off"
				spellcheck={false}
				required={!project}
				oninput={() => (nameError = null)}
			/>

			<div class="flex flex-col gap-1.5">
				<label for="bucket-quota" class="text-sm font-medium text-foreground">Kuota (MB)</label>
				<input
					id="bucket-quota"
					type="text"
					inputmode="numeric"
					autocomplete="off"
					bind:value={quota}
					class="control-input tabular-nums"
					aria-invalid={quotaError ? 'true' : undefined}
					aria-describedby={quotaError ? 'bucket-quota-error' : quotaHintId}
					oninput={() => (quotaError = null)}
				/>
				{#if quotaError}
					<p id="bucket-quota-error" class="text-xs text-error-dark" role="alert">{quotaError}</p>
				{:else}
					<p id={quotaHintId} class="text-xs text-foreground/70">
						{BUCKET_COPY.quotaHint}
						{#if maxQuotaMb !== null}
							Sisa jatah: {formatMegabytes(maxQuotaMb)}.
						{:else}
							{QUOTA_COPY.allocationHint}
						{/if}
					</p>
				{/if}
			</div>

			{#if regions.length > 0}
				<div class="flex flex-col gap-1.5">
					<label for="bucket-region" class="text-sm font-medium text-foreground">Region</label>
					<select
						id="bucket-region"
						bind:value={region}
						class="control-input"
						aria-describedby="bucket-region-hint"
					>
						<option value={AUTO}>{regionAutoLabel(workspaceDefaultRegion)}</option>
						{#each regions as slug (slug)}
							<option value={slug}>{slug}</option>
						{/each}
					</select>
					<p id="bucket-region-hint" class="text-xs text-foreground/70">
						{#if region === AUTO}
							{regionAutoHint(workspaceDefaultRegion)}
						{/if}
						Alamat bucket bisa dijangkau dari region mana pun, jadi region hanya menentukan letak servernya.
					</p>
				</div>
			{/if}

			<p class="text-xs text-muted">{BUCKET_COPY.privateNote}</p>

			{#if formError}
				<p
					role="alert"
					class="rounded-control border border-error/20 bg-error/10 px-3 py-2 text-sm text-foreground"
					data-testid="create-bucket-error"
				>
					{formError}
				</p>
			{/if}
		</form>
	{/if}
</Dialog>

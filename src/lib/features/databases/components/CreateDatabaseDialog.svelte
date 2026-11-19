<script lang="ts">
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { getFieldError } from '$lib/api/errors';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import FormField from '$lib/components/ui/FormField.svelte';
	import { createCreateDatabaseMutation } from '../mutations';
	import { createRegionsQuery } from '../queries';
	import {
		DATABASE_COPY,
		DATABASE_NAME_MAX_LENGTH,
		DATABASE_VARIABLES,
		databaseErrorMessage,
		regionAutoHint,
		regionAutoLabel
	} from '../presentation';
	import { databaseHref } from '../routes';

	type Props = {
		open: boolean;
		workspaceId: string;
		workspaceName: string;
		/** Why the quota refuses a new database now; the dialog says so instead of the form. */
		blockedReason?: string | null;
		/** A project's region when the user came from a project, otherwise the API's default. */
		defaultRegion?: string | null;
		/** The workspace's own default region, which "Otomatis" resolves to; `null` for any region. */
		workspaceDefaultRegion?: string | null;
		/** Carried to the database page, which preselects it when attaching. */
		projectId?: string | null;
		projectName?: string | null;
	};

	let {
		open = $bindable(false),
		workspaceId,
		workspaceName,
		blockedReason = null,
		defaultRegion = null,
		workspaceDefaultRegion = null,
		projectId = null,
		projectName = null
	}: Props = $props();

	const AUTO = '';

	const regionsQuery = createRegionsQuery(() => open);
	const createMutation = createCreateDatabaseMutation();

	let name = $state('');
	let region = $state(AUTO);
	let nameError = $state<string | null>(null);
	let formError = $state<string | null>(null);
	// `isPending` flips a tick after mutate(), too late for a double click.
	let submitting = false;

	const regions = $derived(regionsQuery.data ?? []);

	let defaultApplied = false;

	$effect(() => {
		if (!open) return;
		name = '';
		nameError = null;
		formError = null;
		region = AUTO;
		defaultApplied = false;
	});

	// The project's region once the list is known, so the database lands where the project runs.
	// Once per opening: a later refetch must not undo the user's choice.
	$effect(() => {
		if (!open || defaultApplied || !defaultRegion || !regions.includes(defaultRegion)) return;
		region = defaultRegion;
		defaultApplied = true;
	});

	async function handleCreate() {
		if (submitting || blockedReason) return;
		const trimmed = name.trim();
		nameError = null;
		formError = null;
		if (!trimmed) {
			nameError = 'Isi nama database, misalnya nama aplikasi yang memakainya.';
			return;
		}
		if (trimmed.length > DATABASE_NAME_MAX_LENGTH) {
			nameError = `Nama database paling panjang ${DATABASE_NAME_MAX_LENGTH} karakter.`;
			return;
		}

		submitting = true;
		try {
			const database = await createMutation.mutateAsync({
				workspaceId,
				payload: { name: trimmed, region: region === AUTO ? null : region }
			});
			open = false;
			toast.success(`Database ${database.name} sedang dibuat.`);
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved, plus a query
			await goto(databaseHref(workspaceId, database.id, { projectId: projectId ?? undefined }));
		} catch (error) {
			nameError = getFieldError(error, 'name') ?? null;
			if (!nameError) {
				formError =
					getFieldError(error, 'region') ??
					databaseErrorMessage(error, 'create', 'Database belum bisa dibuat. Silakan coba lagi.');
			}
		} finally {
			submitting = false;
		}
	}
</script>

<Dialog
	bind:open
	title="Buat database"
	descriptionClass="text-muted"
	class="max-w-lg"
	confirmLabel={createMutation.isPending ? DATABASE_COPY.creating : DATABASE_COPY.create}
	loading={createMutation.isPending}
	initialFocus={blockedReason ? 'cancel' : () => document.getElementById('database-name')}
	confirmDisabled={Boolean(blockedReason)}
	confirmDescribedBy={blockedReason ? 'create-database-blocked' : undefined}
	hideConfirm={Boolean(blockedReason)}
	cancelLabel={blockedReason ? 'Tutup' : 'Batal'}
	onConfirm={handleCreate}
>
	{#snippet description()}
		PostgreSQL milik <span class="font-medium wrap-anywhere text-foreground">{workspaceName}</span>.
		Setelah siap, pasang ke proyek, dan aplikasinya menerima
		<code class="font-mono text-xs text-foreground">{DATABASE_VARIABLES[0]}</code> serta variabel
		<code class="font-mono text-xs text-foreground">DB_*</code> saat deploy berikutnya.
	{/snippet}

	{#if blockedReason}
		<p
			id="create-database-blocked"
			role="alert"
			class="rounded-control border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-foreground"
			data-testid="create-database-blocked"
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
				id="database-name"
				label="Nama database"
				bind:value={name}
				placeholder="toko-kopi-db"
				hint={DATABASE_COPY.nameHint}
				error={nameError}
				autocomplete="off"
				spellcheck={false}
				required
				oninput={() => (nameError = null)}
			/>

			{#if regions.length > 0}
				<div class="flex flex-col gap-1.5">
					<label for="database-region" class="text-sm font-medium text-foreground">Region</label>
					<select
						id="database-region"
						bind:value={region}
						class="control-input"
						aria-describedby="database-region-hint"
					>
						<option value={AUTO}>{regionAutoLabel(workspaceDefaultRegion)}</option>
						{#each regions as slug (slug)}
							<option value={slug}>{slug}</option>
						{/each}
					</select>
					<p id="database-region-hint" class="text-xs text-foreground/70">
						{#if region === AUTO}
							{regionAutoHint(workspaceDefaultRegion)}
						{:else if projectName && region === defaultRegion}
							Region yang sama dengan proyek {projectName}.
						{/if}
						{DATABASE_COPY.regionRule}
					</p>
				</div>
			{:else if regionsQuery.isSuccess}
				<p class="text-xs text-foreground/70">{regionAutoHint(workspaceDefaultRegion)}</p>
			{/if}

			{#if formError}
				<p
					role="alert"
					class="rounded-control border border-error/20 bg-error/10 px-3 py-2 text-sm text-foreground"
					data-testid="create-database-error"
				>
					{formError}
				</p>
			{/if}
		</form>
	{/if}
</Dialog>

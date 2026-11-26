<script lang="ts">
	// Links come from resolveRoute() in the routes helpers, some with a query string.
	/* eslint-disable svelte/no-navigation-without-resolve */
	import Plus from 'phosphor-svelte/lib/Plus';
	import Warning from 'phosphor-svelte/lib/Warning';
	import { toast } from 'svelte-sonner';
	import { getErrorMessage } from '$lib/api/errors';
	import { VALKEY_MODE, type ValkeyAttachment } from '$lib/api/resources/valkeys';
	import { ValkeyIcon } from '$lib/components/icons';
	import Badge from '$lib/components/ui/Badge.svelte';
	import InjectedVariables from '$lib/features/projects/components/detail/InjectedVariables.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import { isLaravelStack } from '$lib/features/projects/build-help';
	import { createAddEnvironmentVariableMutation } from '$lib/features/projects/mutations';
	import type { Project } from '$lib/features/projects/type';
	import { limitsWorkspaceId } from '$lib/features/workspaces/presentation';
	import { createWorkspaceLimitsQuery } from '$lib/features/workspaces/queries';
	import { createDetachValkeyMutation } from '../mutations';
	import {
		canOfferProjectValkey,
		valkeyErrorMessage,
		valkeyModeView,
		valkeyStatusView,
		valkeysInUse
	} from '../presentation';
	import { laravelSuggestionState, valkeyVariableRows } from '../project-variables';
	import { newValkeyHref, valkeyHref } from '../routes';
	import AttachProjectValkeyDialog from './AttachProjectValkeyDialog.svelte';
	import ValkeyModeLabel from './ValkeyModeLabel.svelte';

	type Props = {
		project: Pick<Project, 'id' | 'name' | 'project_name' | 'valkeys' | 'workspace' | 'stack'>;
		readOnly: boolean;
		/** The project's own variables, `null` for a secret value; `undefined` while they load. */
		projectValues: ReadonlyMap<string, string | null> | undefined;
	};

	let { project, readOnly, projectValues }: Props = $props();

	// `valkeys` is absent while the server's Valkey flag is off: then this section never renders.
	const featureOn = $derived(project.valkeys !== undefined);
	const valkey = $derived(project.valkeys?.[0] ?? null);
	const rows = $derived(valkey ? valkeyVariableRows(valkey) : []);
	const view = $derived(
		valkey
			? valkeyStatusView({ status: valkey.status, last_failure: null, mode: valkey.mode })
			: null
	);
	const workspaceId = $derived(project.workspace?.id ?? null);
	const projectName = $derived(project.name ?? project.project_name ?? '');

	// Offers appear only where they can work: a workspace opened for Valkey.
	const limitsQuery = createWorkspaceLimitsQuery(
		() => limitsWorkspaceId(project.workspace),
		() => ({ enabled: featureOn && !valkey && !readOnly })
	);
	const showOffer = $derived(
		featureOn && !valkey && !readOnly && Boolean(workspaceId) && valkeysInUse(limitsQuery.data)
	);
	const canCreate = $derived(canOfferProjectValkey(limitsQuery.data));

	// Laravel reads REDIS_URL on its own, but keeps queue and cache elsewhere until told.
	const laravel = $derived(isLaravelStack(project.stack));
	const suggestions = $derived(
		valkey && laravel && projectValues ? laravelSuggestionState(projectValues) : null
	);

	let attachOpen = $state(false);
	let attachTrigger = $state<HTMLElement | null>(null);
	let detachOpen = $state(false);
	let detachTrigger = $state<HTMLElement | null>(null);
	let detachError = $state<string | null>(null);
	let suggestionError = $state<string | null>(null);

	const detachMutation = createDetachValkeyMutation();
	const addMutation = createAddEnvironmentVariableMutation();

	function handleAttached(attachment: ValkeyAttachment) {
		toast.success(
			attachment.redeploy_required
				? `Valkey terpasang ke ${attachment.project.name}. Redeploy supaya aplikasinya tersambung.`
				: `Valkey terpasang ke ${attachment.project.name}.`
		);
	}

	async function detach() {
		if (!valkey || !workspaceId) return;
		detachError = null;
		try {
			await detachMutation.mutateAsync({
				workspaceId,
				valkeyId: valkey.id,
				projectId: project.id
			});
			detachOpen = false;
			toast.success(
				`${valkey.name} dilepas. Redeploy supaya aplikasinya berhenti memakai Valkey itu.`
			);
		} catch (error) {
			detachError = valkeyErrorMessage(
				error,
				'detach',
				'Valkey belum terlepas dari proyek. Muat ulang halaman, lalu lepas lagi.'
			);
		}
	}

	async function addSuggestions() {
		if (!suggestions) return;
		suggestionError = null;
		try {
			for (const suggestion of suggestions.missing) {
				await addMutation.mutateAsync({
					projectId: project.id,
					data: { key: suggestion.key, value: suggestion.value, is_secret: false }
				});
			}
			toast.success(
				`${suggestions.missing.map(({ key, value }) => `${key}=${value}`).join(' dan ')} ditambahkan. Berlaku di deploy berikutnya.`
			);
		} catch (error) {
			suggestionError = getErrorMessage(
				error,
				'Variabel belum ditambahkan. Muat ulang halaman, lalu tambahkan lagi.'
			);
		}
	}
</script>

{#if valkey && view}
	<section
		class="mt-6 flex min-w-0 flex-col gap-3"
		aria-labelledby="valkey-variables-title"
		data-testid="valkey-variables"
	>
		<div class="flex min-w-0 flex-wrap items-center justify-between gap-2">
			<h2
				id="valkey-variables-title"
				class="flex min-w-0 flex-wrap items-center gap-2 text-base text-foreground"
			>
				<ValkeyIcon size={18} class="shrink-0 text-primary-dark" aria-hidden="true" />
				<span class="min-w-0 wrap-anywhere">
					Dari Valkey <span class="font-mono">{valkey.name}</span>
				</span>
				<Badge tone={view.tone}>{view.label}</Badge>
				<ValkeyModeLabel mode={valkey.mode} />
			</h2>
			<div class="flex flex-wrap items-center gap-x-4 gap-y-1">
				{#if workspaceId}
					<a
						href={valkeyHref(workspaceId, valkey.id)}
						class="inline-flex min-h-6 items-center text-sm font-medium text-primary-dark underline underline-offset-2"
					>
						Buka Valkey
					</a>
				{/if}
				{#if !readOnly && workspaceId}
					<Button
						variant="ghost"
						size="sm"
						class="text-error-dark hover:text-error-dark"
						bind:ref={detachTrigger}
						onclick={() => {
							detachError = null;
							detachOpen = true;
						}}
						data-testid="detach-project-valkey"
					>
						Lepas
					</Button>
				{/if}
			</div>
		</div>
		{#if valkey.status !== 'ready'}
			<p class="text-sm text-foreground" data-testid="valkey-variables-status">
				{view.description}
			</p>
		{/if}

		<InjectedVariables {rows} source={`Valkey ${valkey.name}`} testidPrefix="valkey-variable" />

		{#if rows.some((row) => row.overridden)}
			<p
				class="flex items-start gap-2 text-sm text-foreground"
				data-testid="valkey-variables-conflict"
			>
				<Warning size={16} class="mt-0.5 shrink-0 text-warning-dark" aria-hidden="true" />
				<span> Hapus variabel bertanda "Menimpa Valkey" agar Valkey ini yang dipakai. </span>
			</p>
		{/if}

		{#if valkey.mode === VALKEY_MODE.cache}
			<p
				class="flex items-start gap-2 rounded-control border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground"
				data-testid="valkey-variables-cache-warning"
			>
				<Warning size={16} class="mt-0.5 shrink-0 text-warning-dark" aria-hidden="true" />
				<span>
					Mode cache: {valkeyModeView(valkey.mode).summary} Jangan dipakai untuk antrean atau sesi.
				</span>
			</p>
		{/if}

		{#if suggestions && (suggestions.missing.length > 0 || suggestions.different.length > 0)}
			<div
				class="flex flex-col gap-2 rounded-control border border-border bg-background-soft px-4 py-3 text-sm text-foreground"
				data-testid="valkey-laravel-hint"
			>
				<p>Antrean dan cache Laravel baru memakai Valkey lewat variabel proyek.</p>
				{#each suggestions.different as item (item.key)}
					<p data-testid={`valkey-laravel-different-${item.key}`}>
						<code class="font-mono text-xs">{item.key}</code> sekarang
						{#if item.current !== null}
							<code class="font-mono text-xs">{item.current}</code>.
						{:else}
							berupa secret.
						{/if}
						Ubah menjadi <code class="font-mono text-xs">{item.value}</code> di daftar variabel di atas
						untuk memakai Valkey.
					</p>
				{/each}
				{#if suggestions.missing.length > 0 && !readOnly}
					<Button
						variant="secondary"
						size="sm"
						class="self-start"
						onclick={addSuggestions}
						disabled={addMutation.isPending}
						data-testid="add-valkey-laravel-variables"
					>
						<Plus size={16} weight="bold" aria-hidden="true" />
						{addMutation.isPending
							? 'Menambahkan...'
							: `Tambahkan ${suggestions.missing.map(({ key, value }) => `${key}=${value}`).join(' dan ')}`}
					</Button>
				{/if}
				{#if suggestionError}
					<p role="alert" class="text-error-dark">{suggestionError}</p>
				{/if}
			</div>
		{/if}
	</section>

	{#if !readOnly}
		<Dialog
			bind:open={detachOpen}
			title={`Lepas ${valkey.name} dari proyek ini?`}
			confirmLabel={detachMutation.isPending ? 'Melepas...' : 'Lepas Valkey'}
			variant="destructive"
			loading={detachMutation.isPending}
			returnFocus={() => detachTrigger}
			onConfirm={detach}
			class="max-w-lg"
		>
			<div
				class="flex flex-col gap-3 text-sm text-foreground"
				data-testid="detach-project-valkey-dialog"
			>
				<p>
					<span class="font-medium wrap-anywhere">{projectName}</span> berhenti tersambung ke Valkey ini
					mulai deploy berikutnya. Isinya tetap ada, dan bisa dipasang lagi kapan saja.
				</p>
				<p>Sampai di-redeploy, aplikasi yang sedang berjalan masih memakai Valkey ini.</p>
				{#if detachError}
					<p role="alert" class="text-error-dark">{detachError}</p>
				{/if}
			</div>
		</Dialog>
	{/if}
{:else if showOffer && workspaceId}
	<div class="mt-6 flex flex-col gap-2" data-testid="valkey-variables-offer">
		<p class="text-sm text-muted">
			Butuh Redis untuk antrean, cache, atau sesi? Sakala mengisi
			<code class="font-mono text-xs text-foreground">REDIS_URL</code> saat deploy.
		</p>
		<div class="flex flex-wrap items-center gap-x-4 gap-y-2">
			<Button
				variant="secondary"
				size="sm"
				bind:ref={attachTrigger}
				onclick={() => (attachOpen = true)}
				data-testid="attach-project-valkey"
			>
				<ValkeyIcon size={16} aria-hidden="true" />
				Pasang Valkey
			</Button>
			{#if canCreate}
				<a
					href={newValkeyHref({ projectId: project.id })}
					class="inline-flex min-h-6 items-center text-sm font-medium text-primary-dark underline underline-offset-2"
					data-testid="create-project-valkey">Buat Valkey untuk proyek ini</a
				>
			{/if}
		</div>
	</div>
	<AttachProjectValkeyDialog
		bind:open={attachOpen}
		{workspaceId}
		project={{ id: project.id, name: projectName }}
		{canCreate}
		returnFocus={() => attachTrigger}
		onAttached={handleAttached}
	/>
{/if}

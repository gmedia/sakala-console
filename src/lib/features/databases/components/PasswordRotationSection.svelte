<script lang="ts">
	import { RotateCredentialIcon } from '$lib/components/icons';
	import CheckCircle from 'phosphor-svelte/lib/CheckCircle';
	import CircleNotch from 'phosphor-svelte/lib/CircleNotch';
	import { toast } from 'svelte-sonner';
	import type { Database } from '$lib/api/resources/databases';
	import Button from '$lib/components/ui/Button.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import type { DatabaseAccess } from '../access';
	import { createRotatePasswordMutation } from '../mutations';
	import { ROTATION_COPY, databaseErrorMessage, isOnNode, rotationView } from '../presentation';
	import RotationProjectRow from './RotationProjectRow.svelte';

	type Props = {
		database: Database;
		workspaceId: string;
		access: DatabaseAccess;
		/** Called once a rotation is requested, so a password shown on the page is dropped. */
		onRequested?: () => void;
	};

	let { database, workspaceId, access, onRequested }: Props = $props();

	const rotateMutation = createRotatePasswordMutation();

	let open = $state(false);
	let redeployAttached = $state(true);
	let error = $state<string | null>(null);
	let trigger = $state<HTMLElement | null>(null);

	const onNode = $derived(isOnNode(database));
	const view = $derived(rotationView(database));
	const hasProjects = $derived(database.projects.length > 0);

	function openDialog() {
		error = null;
		redeployAttached = true;
		open = true;
	}

	async function rotate() {
		error = null;
		try {
			await rotateMutation.mutateAsync({
				workspaceId,
				databaseId: database.id,
				redeployAttached: hasProjects && redeployAttached
			});
			open = false;
			toast.success(ROTATION_COPY.requested);
			onRequested?.();
		} catch (caught) {
			error = databaseErrorMessage(
				caught,
				'rotate',
				'Password database belum diganti. Muat ulang halaman, lalu ganti lagi.'
			);
		}
	}
</script>

<div class="flex flex-col gap-3 border-t border-border pt-4" data-testid="password-rotation">
	{#if access.canManage}
		<div class="flex min-w-0 flex-wrap items-start justify-between gap-3">
			<div class="flex min-w-0 flex-1 basis-64 flex-col gap-1">
				<h3 class="text-sm font-semibold text-foreground">{ROTATION_COPY.title}</h3>
				<p class="text-sm text-muted">{ROTATION_COPY.lead}</p>
			</div>
			<Button
				variant="secondary"
				size="sm"
				bind:ref={trigger}
				disabled={!onNode || view?.state === 'pending'}
				onclick={openDialog}
				data-testid="rotate-password"
			>
				<RotateCredentialIcon size={16} aria-hidden="true" />
				{ROTATION_COPY.action}
			</Button>
		</div>
	{/if}

	<!-- Polite, so the change from pending to done is heard without moving focus. -->
	<div class="flex flex-col gap-3" aria-live="polite">
		{#if view?.state === 'pending'}
			<p
				class="flex items-start gap-2 rounded-control border border-border bg-background-soft px-4 py-3 text-sm text-foreground"
				data-testid="rotation-pending"
			>
				<CircleNotch
					size={16}
					class="mt-0.5 shrink-0 animate-spin text-primary-dark motion-reduce:animate-none"
					aria-hidden="true"
				/>
				{ROTATION_COPY.pending}
			</p>
		{:else if view?.state === 'failed'}
			<p
				class="rounded-control border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground"
				data-testid="rotation-failed"
			>
				{ROTATION_COPY.failedPrefix}
				{view.summary ?? ''}
			</p>
		{:else if view?.state === 'completed'}
			<div class="flex flex-col gap-2" data-testid="rotation-completed">
				<p class="flex items-start gap-2 text-sm font-medium text-foreground">
					<CheckCircle size={16} class="mt-0.5 shrink-0 text-success-dark" aria-hidden="true" />
					{view.completedText}
				</p>
				{#if view.queueing}
					<p class="flex items-start gap-2 text-sm text-foreground" data-testid="rotation-queueing">
						<CircleNotch
							size={16}
							class="mt-0.5 shrink-0 animate-spin text-primary-dark motion-reduce:animate-none"
							aria-hidden="true"
						/>
						{ROTATION_COPY.queueing}
					</p>
				{:else if hasProjects}
					<ul
						class="flex flex-col divide-y divide-border rounded-control border border-border"
						aria-label="Proyek terpasang setelah ganti password"
					>
						{#each database.projects as project (project.id)}
							<RotationProjectRow
								{project}
								redeploy={view.redeploys.get(project.id)}
								canManage={access.canManage}
							/>
						{/each}
					</ul>
				{/if}
			</div>
		{/if}
	</div>
</div>

{#if access.canManage}
	<Dialog
		bind:open
		title={ROTATION_COPY.dialogTitle}
		confirmLabel={rotateMutation.isPending ? ROTATION_COPY.dialogBusy : ROTATION_COPY.dialogConfirm}
		loading={rotateMutation.isPending}
		returnFocus={() => trigger}
		onConfirm={rotate}
		class="max-w-lg"
	>
		<div class="flex flex-col gap-3 text-sm text-foreground" data-testid="rotate-dialog">
			<p>
				Server database membuat password baru untuk <span
					class="font-mono font-medium wrap-anywhere">{database.name}</span
				>. {ROTATION_COPY.dialogEffect}
			</p>
			{#if hasProjects}
				<p>
					{ROTATION_COPY.dialogApps}
					<span class="font-medium wrap-anywhere"
						>{database.projects.map((project) => project.name).join(', ')}</span
					>.
				</p>
				<label
					for="rotate-redeploy-attached"
					class="flex cursor-pointer items-start gap-3 rounded-control border border-border px-4 py-3"
				>
					<input
						id="rotate-redeploy-attached"
						type="checkbox"
						bind:checked={redeployAttached}
						aria-describedby="rotate-redeploy-hint"
						class="mt-0.5 size-5 shrink-0 cursor-pointer"
						data-testid="rotate-redeploy-attached"
					/>
					<span class="flex flex-col gap-1">
						<span class="font-medium">{ROTATION_COPY.autoRedeploy}</span>
						<span id="rotate-redeploy-hint" class="text-muted">
							{redeployAttached ? ROTATION_COPY.autoRedeployHint : ROTATION_COPY.manualRedeploy}
						</span>
					</span>
				</label>
			{:else}
				<p>{ROTATION_COPY.dialogNoProjects}</p>
			{/if}
			{#if error}
				<p role="alert" class="text-error-dark">{error}</p>
			{/if}
		</div>
	</Dialog>
{/if}

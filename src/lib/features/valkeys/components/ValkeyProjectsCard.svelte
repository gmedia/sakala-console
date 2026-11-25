<script lang="ts">
	import LearnMore from '$lib/components/ui/LearnMore.svelte';
	import { VALKEY_ANCHORS } from '../panel';
	// Project links come from resolveRoute() in the database routes helpers.
	/* eslint-disable svelte/no-navigation-without-resolve */
	import ArrowsClockwise from 'phosphor-svelte/lib/ArrowsClockwise';
	import Plugs from 'phosphor-svelte/lib/Plugs';
	import Plus from 'phosphor-svelte/lib/Plus';
	import { toast } from 'svelte-sonner';
	import type { Valkey, ValkeyAttachment, ValkeyProjectRef } from '$lib/api/resources/valkeys';
	import Button from '$lib/components/ui/Button.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import type { ValkeyAccess } from '../access';
	import { createDetachValkeyMutation } from '../mutations';
	import { projectHref, projectVariablesHref } from '$lib/features/databases/routes';
	import {
		VALKEY_COPY,
		valkeyErrorMessage,
		valkeyRedeployNoticeText,
		type ValkeyRedeployNotice
	} from '../presentation';
	import AttachValkeyDialog from './AttachValkeyDialog.svelte';

	type Props = {
		valkey: Valkey;
		workspaceId: string;
		access: ValkeyAccess;
		notices: ValkeyRedeployNotice[];
		preselectedProjectId?: string | null;
		onChanged: (notices: ValkeyRedeployNotice[]) => void;
	};

	let {
		valkey,
		workspaceId,
		access,
		notices,
		preselectedProjectId = null,
		onChanged
	}: Props = $props();

	const detachMutation = createDetachValkeyMutation();

	let attachOpen = $state(false);
	let attachTrigger = $state<HTMLElement | null>(null);
	let detachTarget = $state<ValkeyProjectRef | null>(null);
	let detachOpen = $state(false);
	let detachError = $state<string | null>(null);

	/** Why attaching is not possible now, said beside the button instead of after a refusal. */
	const attachBlocked = $derived.by(() => {
		if (valkey.status === 'ready') return null;
		if (valkey.status === 'locked') {
			return 'Valkey yang sedang dikunci belum bisa dipasang ke proyek lain.';
		}
		if (valkey.status === 'provisioning') return 'Bisa dipasang setelah Valkey siap.';
		return 'Valkey ini tidak bisa dipasang ke proyek.';
	});

	// Opened from a project's link, once the store is ready.
	let preselectHandled = false;
	$effect(() => {
		if (
			preselectedProjectId &&
			!preselectHandled &&
			access.canManage &&
			valkey.status === 'ready' &&
			!valkey.projects.some((project) => project.id === preselectedProjectId)
		) {
			preselectHandled = true;
			attachOpen = true;
		}
	});

	function handleAttached(attachment: ValkeyAttachment) {
		toast.success(`${valkey.name} dipasang ke ${attachment.project.name}.`);
		onChanged([
			{
				projectId: attachment.project.id,
				projectName: attachment.project.name,
				kind: 'attached',
				redeployRequired: attachment.redeploy_required
			}
		]);
	}

	function openDetach(project: ValkeyProjectRef) {
		detachTarget = project;
		detachError = null;
		detachOpen = true;
	}

	async function detach() {
		const project = detachTarget;
		if (!project) return;
		detachError = null;
		try {
			await detachMutation.mutateAsync({
				workspaceId,
				valkeyId: valkey.id,
				projectId: project.id
			});
			detachOpen = false;
			toast.success(`${valkey.name} dilepas dari ${project.name}.`);
			onChanged([{ projectId: project.id, projectName: project.name, kind: 'detached' }]);
		} catch (error) {
			detachError = valkeyErrorMessage(
				error,
				'detach',
				'Valkey belum terlepas dari proyek. Muat ulang halaman, lalu lepas lagi.'
			);
		}
	}
</script>

<section
	id={VALKEY_ANCHORS.projects}
	class="surface-card flex min-w-0 scroll-mt-4 flex-col gap-4 p-4 sm:p-6"
	aria-labelledby="valkey-projects-title"
	data-testid="valkey-projects"
>
	<div class="flex min-w-0 flex-wrap items-start justify-between gap-3">
		<div class="flex min-w-0 flex-1 basis-64 flex-col gap-1">
			<h2 id="valkey-projects-title" class="text-base text-foreground">Proyek terpasang</h2>
			<p class="text-sm text-muted">Menerima REDIS_URL saat deploy berikutnya.</p>
			<LearnMore topic="memasang Valkey ke proyek">
				<p>
					Proyek yang terpasang tersambung ke Valkey ini dan menerima REDIS_URL serta variabel
					REDIS_* lainnya saat deploy berikutnya. Satu proyek memakai satu Valkey, dan hanya proyek
					di server yang sama yang bisa memakainya.
				</p>
			</LearnMore>
		</div>
		{#if access.canManage}
			<div class="flex flex-col items-start gap-1">
				<Button
					size="sm"
					bind:ref={attachTrigger}
					disabled={Boolean(attachBlocked)}
					aria-describedby={attachBlocked ? 'attach-valkey-blocked' : undefined}
					onclick={() => (attachOpen = true)}
					data-testid="attach-valkey"
				>
					<Plus size={16} weight="bold" aria-hidden="true" />
					Pasang ke proyek
				</Button>
			</div>
		{/if}
	</div>

	{#if access.canManage && attachBlocked}
		<p id="attach-valkey-blocked" class="text-sm text-muted">{attachBlocked}</p>
	{/if}

	{#if valkey.projects.length === 0}
		<p
			class="flex items-center gap-2 rounded-control border border-dashed border-border-strong px-4 py-3 text-sm text-muted"
		>
			<Plugs size={18} class="shrink-0" aria-hidden="true" />
			{VALKEY_COPY.noProjects}.
		</p>
	{:else}
		<ul class="flex flex-col divide-y divide-border rounded-control border border-border">
			{#each valkey.projects as project (project.id)}
				<li class="flex min-w-0 flex-wrap items-center justify-between gap-2 px-4 py-2.5">
					<a
						href={projectHref(project.id)}
						class="min-h-6 min-w-0 font-medium wrap-anywhere text-foreground underline-offset-2 hover:underline"
					>
						{project.name}
					</a>
					{#if access.canManage}
						<Button
							variant="ghost"
							size="sm"
							class="text-error-dark hover:text-error-dark"
							id={`detach-${project.id}`}
							onclick={() => openDetach(project)}
							aria-label={`Lepas dari ${project.name}`}
						>
							Lepas
						</Button>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}

	{#if notices.length > 0}
		<ul
			class="flex flex-col gap-2"
			aria-label="Perlu redeploy"
			data-testid="valkey-redeploy-notices"
		>
			{#each notices as notice (notice.projectId)}
				<li
					role="status"
					class="flex min-w-0 flex-col gap-2 rounded-control border border-warning/30 bg-warning/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
				>
					<p class="flex min-w-0 items-start gap-2 text-sm text-foreground">
						<ArrowsClockwise
							size={16}
							class="mt-0.5 shrink-0 text-warning-dark"
							aria-hidden="true"
						/>
						<span class="wrap-anywhere">{valkeyRedeployNoticeText(notice)}</span>
					</p>
					<a
						href={projectVariablesHref(notice.projectId)}
						class="inline-flex min-h-6 shrink-0 items-center text-sm font-medium text-primary-dark underline underline-offset-2"
					>
						{VALKEY_COPY.redeployLink}<span class="sr-only">: {notice.projectName}</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</section>

{#if access.canManage}
	<AttachValkeyDialog
		bind:open={attachOpen}
		{workspaceId}
		{valkey}
		{preselectedProjectId}
		returnFocus={() => attachTrigger}
		onAttached={handleAttached}
	/>

	<Dialog
		bind:open={detachOpen}
		title={`Lepas ${valkey.name}?`}
		confirmLabel={detachMutation.isPending ? 'Melepas...' : 'Lepas Valkey'}
		variant="destructive"
		loading={detachMutation.isPending}
		returnFocus={() => attachTrigger}
		onConfirm={detach}
		class="max-w-lg"
	>
		<div class="flex flex-col gap-3 text-sm text-foreground" data-testid="detach-valkey-dialog">
			<p>
				<span class="font-medium wrap-anywhere">{detachTarget?.name}</span> berhenti tersambung ke Valkey
				ini mulai deploy berikutnya. Isinya tetap ada, dan bisa dipasang lagi kapan saja.
			</p>
			<p>
				Sampai di-redeploy, aplikasi yang sedang berjalan masih tersambung ke Valkey ini. Valkey
				baru bisa dihapus setelah semua proyek yang dilepas di-redeploy.
			</p>
			{#if detachError}
				<p role="alert" class="text-error-dark">{detachError}</p>
			{/if}
		</div>
	</Dialog>
{/if}

<script lang="ts">
	// Project links come from resolveRoute() in the database routes helpers.
	/* eslint-disable svelte/no-navigation-without-resolve */
	import Plugs from 'phosphor-svelte/lib/Plugs';
	import Plus from 'phosphor-svelte/lib/Plus';
	import { toast } from 'svelte-sonner';
	import type { Bucket, BucketAttachment, BucketProjectRef } from '$lib/api/resources/buckets';
	import { DeployIcon } from '$lib/components/icons';
	import Button from '$lib/components/ui/Button.svelte';
	import LearnMore from '$lib/components/ui/LearnMore.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import { BUCKET_ANCHORS } from '../panel';
	import type { BucketAccess } from '../access';
	import { createDetachBucketMutation } from '../mutations';
	import { projectHref, projectVariablesHref } from '$lib/features/databases/routes';
	import {
		BUCKET_COPY,
		bucketErrorMessage,
		bucketRedeployNoticeText,
		type BucketRedeployNotice
	} from '../presentation';
	import AttachBucketDialog from './AttachBucketDialog.svelte';

	type Props = {
		bucket: Bucket;
		workspaceId: string;
		access: BucketAccess;
		notices: BucketRedeployNotice[];
		preselectedProjectId?: string | null;
		onChanged: (notices: BucketRedeployNotice[]) => void;
	};

	let {
		bucket,
		workspaceId,
		access,
		notices,
		preselectedProjectId = null,
		onChanged
	}: Props = $props();

	const detachMutation = createDetachBucketMutation();

	let attachOpen = $state(false);
	let attachTrigger = $state<HTMLElement | null>(null);
	let detachTarget = $state<BucketProjectRef | null>(null);
	let detachOpen = $state(false);
	let detachError = $state<string | null>(null);

	/** Why attaching is not possible now, said beside the button instead of after a refusal. */
	const attachBlocked = $derived.by(() => {
		if (bucket.status === 'ready') return null;
		if (bucket.status === 'locked') {
			return 'Bucket yang dikunci admin Sakala belum bisa dipasang. Hubungi admin untuk membukanya.';
		}
		if (bucket.status === 'provisioning') return 'Bisa dipasang setelah bucket siap.';
		return 'Bucket ini tidak bisa dipasang ke proyek.';
	});

	// Opened from a project's link, once the bucket is ready.
	let preselectHandled = false;
	$effect(() => {
		if (
			preselectedProjectId &&
			!preselectHandled &&
			access.canManage &&
			bucket.status === 'ready' &&
			!bucket.projects.some((project) => project.id === preselectedProjectId)
		) {
			preselectHandled = true;
			attachOpen = true;
		}
	});

	function handleAttached(attachment: BucketAttachment) {
		toast.success(`${bucket.name} dipasang ke ${attachment.project.name}.`);
		onChanged([
			{
				projectId: attachment.project.id,
				projectName: attachment.project.name,
				kind: 'attached',
				redeployRequired: attachment.redeploy_required
			}
		]);
	}

	function openDetach(project: BucketProjectRef) {
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
				bucketId: bucket.id,
				projectId: project.id
			});
			detachOpen = false;
			toast.success(`${bucket.name} dilepas dari ${project.name}.`);
			onChanged([{ projectId: project.id, projectName: project.name, kind: 'detached' }]);
		} catch (error) {
			detachError = bucketErrorMessage(
				error,
				'detach',
				'Bucket belum terlepas dari proyek. Muat ulang halaman, lalu lepas lagi.'
			);
		}
	}
</script>

<section
	id={BUCKET_ANCHORS.projects}
	class="surface-card flex min-w-0 scroll-mt-4 flex-col gap-4 p-4 sm:p-6"
	aria-labelledby="bucket-projects-title"
	data-testid="bucket-projects"
>
	<div class="flex min-w-0 flex-wrap items-start justify-between gap-3">
		<div class="flex min-w-0 flex-1 basis-64 flex-col gap-1">
			<h2 id="bucket-projects-title" class="text-base text-foreground">Proyek terpasang</h2>
			<p class="text-sm text-muted">Menerima variabel AWS_* saat deploy berikutnya.</p>
			<LearnMore topic="memasang bucket ke proyek">
				<p>
					Proyek yang terpasang menerima variabel AWS_* bucket ini saat deploy berikutnya. Satu
					proyek memakai satu bucket.
				</p>
			</LearnMore>
		</div>
		{#if access.canManage}
			<div class="flex flex-col items-start gap-1">
				<Button
					size="sm"
					bind:ref={attachTrigger}
					disabled={Boolean(attachBlocked)}
					aria-describedby={attachBlocked ? 'attach-bucket-blocked' : undefined}
					onclick={() => (attachOpen = true)}
					data-testid="attach-bucket"
				>
					<Plus size={16} weight="bold" aria-hidden="true" />
					Pasang ke proyek
				</Button>
			</div>
		{/if}
	</div>

	{#if access.canManage && attachBlocked}
		<p id="attach-bucket-blocked" class="text-sm text-muted">{attachBlocked}</p>
	{/if}

	{#if bucket.projects.length === 0}
		<p
			class="flex items-center gap-2 rounded-control border border-dashed border-border-strong px-4 py-3 text-sm text-muted"
		>
			<Plugs size={18} class="shrink-0" aria-hidden="true" />
			{BUCKET_COPY.noProjects}.
		</p>
	{:else}
		<ul class="flex flex-col divide-y divide-border rounded-control border border-border">
			{#each bucket.projects as project (project.id)}
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
			data-testid="bucket-redeploy-notices"
		>
			{#each notices as notice (notice.projectId)}
				<li
					role="status"
					class="flex min-w-0 flex-col gap-2 rounded-control border border-warning/30 bg-warning/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
				>
					<p class="flex min-w-0 items-start gap-2 text-sm text-foreground">
						<DeployIcon size={16} class="mt-0.5 shrink-0 text-warning-dark" aria-hidden="true" />
						<span class="wrap-anywhere">{bucketRedeployNoticeText(notice)}</span>
					</p>
					<a
						href={projectVariablesHref(notice.projectId)}
						class="inline-flex min-h-6 shrink-0 items-center text-sm font-medium text-primary-dark underline underline-offset-2"
					>
						{BUCKET_COPY.redeployLink}<span class="sr-only">: {notice.projectName}</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</section>

{#if access.canManage}
	<AttachBucketDialog
		bind:open={attachOpen}
		{workspaceId}
		{bucket}
		{preselectedProjectId}
		returnFocus={() => attachTrigger}
		onAttached={handleAttached}
	/>

	<Dialog
		bind:open={detachOpen}
		title={`Lepas ${bucket.name}?`}
		confirmLabel={detachMutation.isPending ? 'Melepas...' : 'Lepas bucket'}
		variant="destructive"
		loading={detachMutation.isPending}
		returnFocus={() => attachTrigger}
		onConfirm={detach}
		class="max-w-lg"
	>
		<div class="flex flex-col gap-3 text-sm text-foreground" data-testid="detach-bucket-dialog">
			<p>
				<span class="font-medium wrap-anywhere">{detachTarget?.name}</span> berhenti menerima variabel
				bucket ini mulai deploy berikutnya. Berkas di bucket tetap ada, dan bisa dipasang lagi kapan saja.
			</p>
			<p>
				Sampai di-redeploy, aplikasi yang sedang berjalan masih bisa membaca dan menulis ke bucket
				ini.
			</p>
			{#if detachError}
				<p role="alert" class="text-error-dark">{detachError}</p>
			{/if}
		</div>
	</Dialog>
{/if}

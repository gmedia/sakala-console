<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolveRoute } from '$app/paths';
	import ArrowCounterClockwiseIcon from 'phosphor-svelte/lib/ArrowCounterClockwiseIcon';
	import CheckCircleIcon from 'phosphor-svelte/lib/CheckCircleIcon';
	import CircleNotchIcon from 'phosphor-svelte/lib/CircleNotchIcon';
	import LightningIcon from 'phosphor-svelte/lib/LightningIcon';
	import LinkIcon from 'phosphor-svelte/lib/LinkIcon';
	import QuestionIcon from 'phosphor-svelte/lib/QuestionIcon';
	import XCircleIcon from 'phosphor-svelte/lib/XCircleIcon';
	import { ApiError, getErrorMessage } from '$lib/api/errors';
	import type { PilotLimits } from '$lib/api/resources/pilot-limits';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import {
		getDetectedBuilder,
		getDetectedFramework,
		getDetectedPackageManager,
		getInspectedFiles,
		getInspectionFailureMessage,
		getInspectionNotes,
		getInspectionState,
		getPortDescription,
		type DetectedValue
	} from '../../inspection-presentation';
	import { createRedeployMutation, createRequestInspectionMutation } from '../../mutations';
	import { getActiveDeploymentLimitNotice } from '../../presentation';
	import { createProjectInspectionQuery } from '../../queries';

	type Props = {
		projectId: string;
		pilotLimits?: PilotLimits;
		/** How long inspection may stay pending before deploying without it is offered. */
		patienceMs?: number;
	};

	let { projectId, pilotLimits, patienceMs = 120_000 }: Props = $props();

	const projectQuery = createProjectInspectionQuery(() => projectId);
	const inspectMutation = createRequestInspectionMutation();
	const deployMutation = createRedeployMutation();

	const project = $derived(projectQuery.data);
	const inspectionState = $derived(project ? getInspectionState(project) : 'loading');
	const repositoryName = $derived(
		project?.repository_full_name ?? project?.repository_url ?? 'repository ini'
	);

	const facts = $derived(
		project
			? [
					{ label: 'Repository', value: repositoryName },
					{ label: 'Branch', value: project.branch },
					{ label: 'Port', value: getPortDescription(project) }
				]
			: []
	);
	const detections = $derived(
		project
			? [
					{ label: 'Builder', value: getDetectedBuilder(project) },
					{ label: 'Framework', value: getDetectedFramework(project) },
					{ label: 'Package manager', value: getDetectedPackageManager(project) }
				]
			: []
	);

	let waitedLong = $state(false);
	$effect(() => {
		waitedLong = false;
		if (inspectionState !== 'pending') return;
		const timer = setTimeout(() => (waitedLong = true), patienceMs);
		return () => clearTimeout(timer);
	});

	const headline = $derived.by(() => {
		if (inspectionState === 'succeeded') return `Hasil deteksi dari ${repositoryName}.`;
		if (inspectionState === 'failed') return `Sakala belum bisa membaca ${repositoryName}.`;
		return `Sakala sedang memeriksa ${repositoryName}. Analisis pertama bisa makan waktu satu menit atau lebih. Pemeriksaan berjalan di server, jadi halaman ini boleh ditinggal.`;
	});

	const deployLimitNotice = $derived(
		pilotLimits ? getActiveDeploymentLimitNotice(pilotLimits.quotas) : null
	);

	let inspectError = $state('');
	let inspecting = false;

	function handleDetectAgain() {
		if (inspecting) return;
		inspecting = true;
		inspectError = '';
		inspectMutation.mutate(projectId, {
			onError: (error) => {
				inspectError = getErrorMessage(
					error,
					'Deteksi ulang belum bisa dimulai. Silakan coba lagi.'
				);
			},
			onSettled: () => {
				inspecting = false;
			}
		});
	}

	let deployError = $state('');
	// `isPending` updates a tick after mutate(), which is too late for a double click.
	let deploying = false;
	// Kept across a lost response, so the API can tell a retry from a second deployment.
	let idempotencyKey = crypto.randomUUID();

	function handleDeploy() {
		if (deploying || !project) return;
		deploying = true;
		deployError = '';
		deployMutation.mutate(
			{ projectId, branch: project.branch, idempotencyKey },
			{
				onSuccess: (deployment) => {
					void goto(
						resolveRoute('/(app)/projects/[id]/deployments/[deploymentId]', {
							id: projectId,
							deploymentId: deployment.id
						})
					);
				},
				onError: (error) => {
					deployError = getErrorMessage(
						error,
						'Deploy belum berhasil dijalankan. Silakan coba lagi.'
					);
					// A refusal is final for this key: the next attempt is a new request.
					if (error instanceof ApiError) idempotencyKey = crypto.randomUUID();
				},
				onSettled: () => {
					deploying = false;
				}
			}
		);
	}

	let showSkipConfirm = $state(false);

	function handleConfirmSkip() {
		showSkipConfirm = false;
		void goto(resolveRoute('/(app)/projects/[id]', { id: projectId }));
	}
</script>

{#snippet detectedValue(value: DetectedValue)}
	{#if inspectionState === 'pending'}
		<span class="flex items-center gap-2 text-sm text-foreground/70">
			<CircleNotchIcon class="size-5 shrink-0 animate-spin text-primary" aria-hidden="true" />
			Mendeteksi konfigurasi...
		</span>
	{:else if value.kind === 'known'}
		<span class="flex items-center gap-1 font-montserrat-semibold wrap-anywhere">
			<CheckCircleIcon class="size-5 shrink-0 text-primary" aria-hidden="true" />
			{value.text}
		</span>
	{:else if inspectionState === 'failed'}
		<span class="flex items-center gap-1 text-error-dark">
			<XCircleIcon class="size-5 shrink-0" aria-hidden="true" />
			{value.text}
		</span>
	{:else}
		<span class="flex items-center gap-1 text-foreground/70">
			<QuestionIcon class="size-5 shrink-0" aria-hidden="true" />
			{value.text}
		</span>
	{/if}
{/snippet}

<div class="mt-3 flex flex-col gap-4">
	<div>
		<h2 tabindex="-1" data-step-heading class="text-xl font-montserrat-semibold outline-none">
			Sakala membaca proyekmu
		</h2>
		<p class="font-montserrat wrap-anywhere" role="status">{headline}</p>
	</div>

	{#if projectQuery.isPending}
		<Card class="flex flex-col gap-3 rounded-xl border p-4">
			<p class="font-montserrat text-sm text-foreground/70">Memuat data proyek...</p>
		</Card>
	{:else if !project}
		<div class="rounded-lg border border-error/30 bg-error/10 p-4 text-sm" role="alert">
			<p>
				{getErrorMessage(projectQuery.error, 'Data proyek belum bisa dimuat.')} Proyeknya tidak ikut terhapus.
			</p>
			<Button variant="outline" class="mt-3 px-3 py-2" onclick={() => projectQuery.refetch()}>
				Coba lagi
			</Button>
		</div>
	{:else}
		<Card class="rounded-xl border p-4">
			<dl class="flex flex-col">
				{#each facts as fact (fact.label)}
					<div
						class="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-muted/20 py-3"
					>
						<dt class="font-montserrat">{fact.label}</dt>
						<dd class="min-w-0 font-jetbrains-mono-semibold wrap-anywhere">{fact.value}</dd>
					</div>
				{/each}
				{#each detections as detection (detection.label)}
					<div
						class="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-muted/20 py-3 last:border-b-0"
					>
						<dt class="font-montserrat">{detection.label}</dt>
						<dd class="min-w-0">{@render detectedValue(detection.value)}</dd>
					</div>
				{/each}
			</dl>
		</Card>

		{#if inspectionState === 'succeeded'}
			{@const files = getInspectedFiles(project)}
			{#if files.length > 0}
				<p class="font-montserrat text-sm wrap-anywhere">Berkas yang terbaca: {files.join(', ')}</p>
			{/if}
			{#each getInspectionNotes(project) as note (note)}
				<p class="font-montserrat text-sm">{note}</p>
			{/each}
		{:else if inspectionState === 'failed'}
			<p class="rounded-lg border border-error/30 bg-error/10 p-3 text-sm" role="alert">
				{getInspectionFailureMessage(project)}
			</p>
		{:else if waitedLong}
			<p class="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
				Analisis masih berjalan, dan ini belum berarti gagal. Kamu tidak perlu menunggu hasilnya:
				Sakala tetap memilih cara build saat deploy.
			</p>
		{/if}

		<div class="flex items-center gap-2 rounded-lg bg-primary/8 p-4 text-primary-dark">
			<LinkIcon class="size-6 shrink-0" aria-hidden="true" />
			<div class="min-w-0">
				<p class="font-jetbrains-mono-regular wrap-anywhere" data-testid="project-domain">
					{project.default_domain ?? 'Domain belum tersedia'}
				</p>
				<p class="font-montserrat text-xs text-foreground/70">
					Alamat ini baru aktif setelah deploy pertama berhasil.
				</p>
			</div>
		</div>

		{#if deployLimitNotice}
			<p class="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
				{deployLimitNotice}
			</p>
		{/if}
		{#if inspectError}
			<p class="text-sm text-error-dark" role="alert">{inspectError}</p>
		{/if}
		{#if deployError}
			<p class="text-sm text-error-dark" role="alert">{deployError}</p>
		{/if}

		<div class="flex flex-col gap-2">
			{#if inspectionState === 'failed'}
				<Button
					variant="primary"
					class="w-full gap-2 py-3"
					disabled={inspectMutation.isPending}
					onclick={handleDetectAgain}
				>
					<ArrowCounterClockwiseIcon class="size-5" aria-hidden="true" />
					Detect ulang
				</Button>
			{:else}
				<Button
					variant="primary"
					class="w-full gap-2 py-3"
					disabled={deployMutation.isPending || (inspectionState === 'pending' && !waitedLong)}
					onclick={handleDeploy}
				>
					{#if deployMutation.isPending}
						<CircleNotchIcon class="size-5 animate-spin" aria-hidden="true" />
					{:else}
						<LightningIcon class="size-5" aria-hidden="true" />
					{/if}
					Deploy sekarang
				</Button>
			{/if}
			<Button
				variant="ghost"
				class="w-full border-none py-3 text-primary hover:text-primary-dark"
				onclick={() => (showSkipConfirm = true)}
			>
				Lewati
			</Button>
		</div>
	{/if}
</div>

<Dialog
	bind:open={showSkipConfirm}
	class="text-center"
	title="Lewati deploy untuk sekarang?"
	description={`Proyek ${project?.name ?? 'ini'} sudah dibuat dan tetap tersimpan, tapi belum di-deploy, jadi belum bisa diakses publik. Kamu bisa deploy kapan saja dari halaman proyek.`}
	confirmLabel="Ya, lewati"
	cancelLabel="Lanjutkan proses"
	emphasis="cancel"
	onConfirm={handleConfirmSkip}
/>

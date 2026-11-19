<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolveRoute } from '$app/paths';
	import ArrowCounterClockwiseIcon from 'phosphor-svelte/lib/ArrowCounterClockwiseIcon';
	import CheckCircleIcon from 'phosphor-svelte/lib/CheckCircleIcon';
	import CircleNotchIcon from 'phosphor-svelte/lib/CircleNotchIcon';
	import ArrowsClockwise from 'phosphor-svelte/lib/ArrowsClockwise';
	import LinkIcon from 'phosphor-svelte/lib/LinkIcon';
	import QuestionIcon from 'phosphor-svelte/lib/QuestionIcon';
	import XCircleIcon from 'phosphor-svelte/lib/XCircleIcon';
	import { ApiError, getErrorMessage } from '$lib/api/errors';
	import type { PilotLimits } from '$lib/api/resources/pilot-limits';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import {
		getDetectedBuilder,
		getDetectedFramework,
		getDetectedPackageManager,
		getInspectedFiles,
		getInspectionFailureMessage,
		getInspectionNotes,
		getInspectionState,
		getPortDescription,
		isPortSettled,
		type DetectedValue
	} from '../../inspection-presentation';
	import { createRedeployMutation, createRequestInspectionMutation } from '../../mutations';
	import { getActiveDeploymentLimitNotice } from '../../presentation';
	import { createProjectInspectionQuery } from '../../queries';
	import { createWorkspaceLimitsQuery } from '$lib/features/workspaces/queries';
	import WizardStepFooter from './WizardStepFooter.svelte';

	type Props = {
		projectId: string;
		pilotLimits?: PilotLimits;
		/**
		 * "Buat dan deploy" was chosen: the first deployment starts by itself as soon as the port it
		 * will use is settled, without another click.
		 */
		autoDeploy?: boolean;
		/** How long inspection may stay pending before deploying without it is offered. */
		patienceMs?: number;
	};

	let { projectId, pilotLimits, autoDeploy = false, patienceMs = 120_000 }: Props = $props();

	const projectQuery = createProjectInspectionQuery(() => projectId);
	const inspectMutation = createRequestInspectionMutation();
	const deployMutation = createRedeployMutation();

	const project = $derived(projectQuery.data);
	const inspectionState = $derived(project ? getInspectionState(project) : 'loading');
	const portSettled = $derived(project ? isPortSettled(project) : false);
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

	// After a reload the wizard no longer knows which workspace was picked, but the project does.
	const team = $derived(project?.workspace?.type === 'team' ? project.workspace : null);
	const teamLimitsQuery = createWorkspaceLimitsQuery(
		() => team?.id ?? null,
		() => ({ enabled: team !== null })
	);
	const limits = $derived(team ? teamLimitsQuery.data : pilotLimits);
	const deployLimitNotice = $derived(
		limits ? getActiveDeploymentLimitNotice(limits.quotas, team?.name) : null
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

	function openDeployment(deploymentId: string) {
		void goto(
			resolveRoute('/(app)/projects/[id]/deployments/[deploymentId]', {
				id: projectId,
				deploymentId
			})
		);
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
				onSuccess: (deployment) => openDeployment(deployment.id),
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

	// Starts once. A failed attempt leaves the button to the user instead of retrying by itself.
	let autoStarted = false;
	$effect(() => {
		if (!autoDeploy || autoStarted || !project) return;
		// A reload after the deployment started: open it rather than starting a second one.
		if (project.latest_deployment) {
			autoStarted = true;
			openDeployment(project.latest_deployment.id);
			return;
		}
		if (!portSettled) return;
		autoStarted = true;
		handleDeploy();
	});

	const waitingForPort = $derived(autoDeploy && inspectionState === 'pending' && !portSettled);
	const canDeploy = $derived(portSettled || waitedLong);

	const headline = $derived.by(() => {
		if (inspectionState === 'failed') return `Sakala belum bisa membaca ${repositoryName}.`;
		if (autoDeploy && portSettled && !deployError) {
			return `Memulai deployment pertama dari ${repositoryName}...`;
		}
		if (waitingForPort && !waitedLong) {
			return `Sakala sedang membaca ${repositoryName} untuk tahu port aplikasimu. Deploy dimulai otomatis setelah itu, biasanya dalam satu menit.`;
		}
		if (inspectionState === 'succeeded') return `Hasil deteksi dari ${repositoryName}.`;
		return `Sakala sedang memeriksa ${repositoryName}. Analisis pertama bisa makan waktu satu menit atau lebih. Pemeriksaan berjalan di server, jadi halaman ini boleh ditinggal.`;
	});
</script>

{#snippet detectedValue(value: DetectedValue)}
	{#if inspectionState === 'pending'}
		<span class="flex items-center gap-2 text-sm text-foreground/70">
			<CircleNotchIcon
				class="size-5 shrink-0 animate-spin text-primary motion-reduce:animate-none"
				aria-hidden="true"
			/>
			Mendeteksi konfigurasi...
		</span>
	{:else if value.kind === 'known'}
		<span class="flex items-center gap-1 font-semibold wrap-anywhere">
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
		<h2 tabindex="-1" data-step-heading class="text-xl font-semibold outline-none">
			Deploy pertama
		</h2>
		<p class="wrap-anywhere" role="status">{headline}</p>
	</div>

	{#if projectQuery.isPending}
		<Card class="flex flex-col gap-3 rounded-card border p-4">
			<p class="text-sm text-foreground/70">Memuat data proyek...</p>
		</Card>
	{:else if !project}
		<div class="rounded-control border border-error/30 bg-error/10 p-4 text-sm" role="alert">
			<p>
				{getErrorMessage(projectQuery.error, 'Data proyek belum bisa dimuat.')} Proyeknya tidak ikut terhapus.
			</p>
			<Button variant="secondary" onclick={() => projectQuery.refetch()}>Coba lagi</Button>
		</div>
	{:else}
		<Card class="rounded-card border p-4">
			<dl class="flex flex-col">
				{#each facts as fact (fact.label)}
					<div
						class="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border py-3"
					>
						<dt>{fact.label}</dt>
						<dd class="min-w-0 font-mono font-semibold wrap-anywhere">{fact.value}</dd>
					</div>
				{/each}
				{#each detections as detection (detection.label)}
					<div
						class="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border py-3 last:border-b-0"
					>
						<dt>{detection.label}</dt>
						<dd class="min-w-0">{@render detectedValue(detection.value)}</dd>
					</div>
				{/each}
			</dl>
		</Card>

		{#if inspectionState === 'succeeded'}
			{@const files = getInspectedFiles(project)}
			{#if files.length > 0}
				<p class="text-sm wrap-anywhere">Berkas yang terbaca: {files.join(', ')}</p>
			{/if}
			{#each getInspectionNotes(project) as note (note)}
				<p class="text-sm">{note}</p>
			{/each}
		{:else if inspectionState === 'failed'}
			<p class="rounded-control border border-error/30 bg-error/10 p-3 text-sm" role="alert">
				{getInspectionFailureMessage(project)}
			</p>
		{:else if waitedLong && !portSettled}
			<p class="rounded-control border border-warning/40 bg-warning/10 p-3 text-sm">
				Analisis masih berjalan, dan ini belum berarti gagal. Kamu tidak perlu menunggu hasilnya:
				Sakala tetap memilih cara build saat deploy. Kalau repository-mu memakai Dockerfile dengan
				port selain PORT, isi Port di Pengaturan proyek dulu.
			</p>
		{/if}

		<div class="flex items-center gap-2 rounded-control bg-primary/8 p-4 text-primary-dark">
			<LinkIcon class="size-6 shrink-0" aria-hidden="true" />
			<div class="min-w-0">
				<p class="font-mono wrap-anywhere" data-testid="project-domain">
					{project.default_domain ?? 'Domain belum tersedia'}
				</p>
				<p class="text-xs text-foreground/70">
					Alamat ini baru aktif setelah deploy pertama berhasil.
				</p>
			</div>
		</div>

		{#if deployLimitNotice}
			<p class="rounded-control border border-warning/40 bg-warning/10 p-3 text-sm">
				{deployLimitNotice}
			</p>
		{/if}
		{#if inspectError}
			<p class="text-sm text-error-dark" role="alert">{inspectError}</p>
		{/if}
		{#if deployError}
			<p class="text-sm text-error-dark" role="alert">{deployError}</p>
		{/if}

		<WizardStepFooter>
			{#if inspectionState === 'failed'}
				<Button
					size="lg"
					class="w-full sm:w-auto"
					disabled={inspectMutation.isPending}
					onclick={handleDetectAgain}
				>
					<ArrowCounterClockwiseIcon class="size-5" aria-hidden="true" />
					Deteksi ulang
				</Button>
			{:else}
				<Button
					size="lg"
					class="w-full sm:w-auto"
					disabled={deployMutation.isPending || !canDeploy}
					aria-busy={deployMutation.isPending}
					onclick={handleDeploy}
				>
					{#if deployMutation.isPending || (waitingForPort && !waitedLong)}
						<CircleNotchIcon
							class="size-5 animate-spin motion-reduce:animate-none"
							aria-hidden="true"
						/>
					{:else}
						<ArrowsClockwise size={18} aria-hidden="true" />
					{/if}
					Deploy sekarang
				</Button>
			{/if}
		</WizardStepFooter>
	{/if}
</div>

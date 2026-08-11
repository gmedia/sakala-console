<script lang="ts">
	import { RefreshCw, RotateCcw, Check, X, ArrowRight, Copy } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import EmptyState from '$lib/components/feedback/EmptyState.svelte';
	import DeploymentTimeline from '../../../deployments/components/DeploymentTimeline.svelte';
	import DeploymentLogConsole from '../../../deployments/components/DeploymentLogConsole.svelte';
	import type { DeploymentStep } from '../../type';
	import Card from '$lib/components/ui/Card.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { getCreateProjectContext } from '$lib/features/projects/create/createProjectContext';

	type Props = {
		projectName: string;
	};

	type EmptyStateConfig = {
		icon: typeof RefreshCw | typeof Check | typeof X;
		tones: 'neutral' | 'failed' | 'warning' | 'muted';
		title: string;
		description: string;
	};

	let { projectName }: Props = $props();

	const wizard = getCreateProjectContext();

	let copied = $state(false);
	let timeoutId: ReturnType<typeof setTimeout> | undefined;

	const url = $derived(`http://${projectName}.run.sakala.dev`);

	async function copyToClipboard() {
		try {
			await navigator.clipboard.writeText(url);
			copied = true;

			clearTimeout(timeoutId);
			timeoutId = setTimeout(() => {
				copied = false;
			}, 2000);
		} catch (err) {
			console.error('Gagal copy ke clipboard:', err);
		}
	}

	const steps: DeploymentStep[] = [
		{ key: 'clone', title: 'Cloning repository', status: 'success' },
		{ key: 'analyze', title: 'Menganalisis proyek', status: 'success' },
		{ key: 'build', title: 'Building image', status: 'running' },
		{ key: 'deploy', title: 'Deploy container', status: 'pending' },
		{ key: 'health', title: 'Health check - live', status: 'pending' }
	] as const;

	const deployLogs = [
		{ timestamp: '08:41:02', message: 'Cloning GMedia/Sakala 2@main...' },
		{ timestamp: '08:41:05', message: 'Dockerfile detected, using custom builder' },
		{ timestamp: '08:41:08', message: 'Step 1/6 : FROM node:20-alpine', variant: 'highlight' },
		{ timestamp: '08:41:11', message: 'Step 4/6 : RUN npm install', variant: 'highlight' }
	] as const;

	let overallStatus = $derived.by(() => {
		if (wizard.deployStatus === 'cancelled') return 'cancelled';
		if (wizard.deployStatus === 'cancelling') return 'cancelling';
		if (steps.some((step) => step.status === 'failed')) return 'failed';
		if (steps.every((step) => step.status === 'success')) return 'success';
		return 'running';
	});

	const emptyStateConfig = $derived.by<EmptyStateConfig>(() => {
		switch (overallStatus) {
			case 'success':
				return {
					icon: Check,
					tones: 'neutral',
					title: 'Proyekmu sudah live',
					description: `${projectName ?? 'Project'} berhasil dibuat dan bisa diakses publik sekarang.`
				};

			case 'failed':
				return {
					icon: X,
					tones: 'failed',
					title: 'Deploy gagal',
					description: `${projectName ?? 'Project'} belum berhasil dideploy. Belum ada URL publik yang aktif untuk proyek ini.`
				};

			case 'cancelling':
				return {
					icon: RefreshCw,
					tones: 'muted',
					title: 'Membatalkan deployment...',
					description: 'Sedang menghentikan proses deployment, harap tunggu sebentar.'
				};

			case 'cancelled':
				return {
					icon: X,
					tones: 'muted',
					title: 'Deployment dibatalkan',
					description:
						'Proses deploy dihentikan sebelum selesai. Repository dan pengaturan yang sudah dipilih tidak hilang, kamu bisa coba lagi kapan saja.'
				};

			default:
				return {
					icon: RefreshCw,
					tones: 'neutral',
					title: `Mendeploy ${projectName ?? 'repository'}...`,
					description: 'Proses deployment sedang berjalan, harap tunggu sebentar.'
				};
		}
	});

	function handleRetryDeploy() {
		wizard.goToDeploy();
	}
</script>

<EmptyState
	icon={emptyStateConfig?.icon}
	tone={emptyStateConfig?.tones}
	class="bg-transparent border-none shadow-none sm:py-0"
	title={emptyStateConfig?.title}
	description={emptyStateConfig?.description}
/>

{#if overallStatus === 'running'}
	<div class="flex flex-col rounded-lg p-4">
		<DeploymentTimeline {steps} />
	</div>
	<DeploymentLogConsole lines={deployLogs} />
{:else if overallStatus === 'success'}
	<div class="flex flex-col rounded-lg">
		<Card>
			<div class="flex justify-between items-center gap-2 w-full border-muted/20">
				<p class="text-primary font-jetbrains-mono-semibold">{url}</p>
				<Button
					class="p-3 bg-background border border-muted"
					variant="outline"
					onclick={copyToClipboard}
					aria-label={copied ? 'Tersalin' : 'Salin URL'}
				>
					{#if copied}
						<Check class="w-5 h-5 text-primary" />
					{:else}
						<Copy class="w-5 h-5 text-muted" />
					{/if}
				</Button>
			</div>
		</Card>
	</div>
	<div class="flex gap-2 w-full">
		<Button variant="outline" class="mt-4 w-full justify-center gap-2 border-black py-3">
			Lihat Detail Proyek
		</Button>
		<Button
			variant="primary"
			class="mt-4 w-full justify-center gap-2 border-2 py-3 border-none text-white cursor-pointer"
		>
			Buka situs
			<ArrowRight class="w-5 h-5" />
		</Button>
	</div>
{:else if overallStatus === 'failed'}
	<div class="flex flex-col rounded-lg p-4">
		<Card class="bg-error/10 border border-error rounded-lg">
			<p class="font-montserrat-semibold text-error">BUILD ERROR</p>
			<p class="font-jetbrains-mono-regular text-error">
				Cannot find module 'package.json' Build failed with exit code 1
			</p>
		</Card>
	</div>
	<div class="flex gap-2 w-full">
		<Button variant="outline" class="mt-4 w-full justify-center gap-2 border-black py-3">
			Lihat log lengkap
		</Button>
		<Button
			variant="primary"
			class="mt-4 w-full justify-center gap-2 border-2 py-3 border-none text-white cursor-pointer"
		>
			<RotateCcw class="w-5 h-5" />
			Coba lagi
		</Button>
	</div>
{:else if overallStatus === 'cancelled'}
	<div class="flex gap-2 w-full">
		<Button
			href={resolve('/projects')}
			variant="outline"
			class="mt-4 w-full justify-center gap-2 border-black py-3"
		>
			Kembali ke project
		</Button>
		<Button
			variant="primary"
			class="mt-4 w-full justify-center gap-2 border-2 py-3 border-none text-white cursor-pointer"
			onclick={handleRetryDeploy}
		>
			<RotateCcw class="w-5 h-5" />
			Coba deploy lagi
		</Button>
	</div>
{/if}

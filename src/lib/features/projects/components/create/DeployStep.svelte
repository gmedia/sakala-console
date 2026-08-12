<script lang="ts">
	import { RefreshCw, RotateCcw, Check, X, ArrowRight, Copy } from '@lucide/svelte';
	import EmptyState from '$lib/components/feedback/EmptyState.svelte';
	import { resolve } from '$app/paths';
	import DeploymentTimeline from '$lib/features/deployments/components/DeploymentTimeline.svelte';
	import DeploymentLogConsole from '$lib/features/deployments/components/DeploymentLogConsole.svelte';
	import type { DeploymentStep } from '../../type';
	import Card from '$lib/components/ui/Card.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { getCreateProjectContext } from '$lib/features/projects/create/createProjectContext';
	import {
		streamDeploymentProgress,
		type DeployScenario,
		type DeployLogLine
	} from '$lib/features/projects/mock/mockDeployment';

	type EmptyStateConfig = {
		icon: typeof RefreshCw | typeof Check | typeof X;
		tones: 'neutral' | 'failed' | 'warning' | 'muted';
		title: string;
		description: string;
	};

	const wizard = getCreateProjectContext();

	let steps = $state<DeploymentStep[]>([]);
	let deployLogs = $state<DeployLogLine[]>([]);
	let buildError = $state<string | null>(null);
	let copied = $state(false);
	let timeoutId: ReturnType<typeof setTimeout> | undefined;
	let destroyed = false;

	const url = $derived(`http://${wizard.projectName}.run.sakala.dev`);

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

	async function runDeployment(scenario: DeployScenario = 'success') {
		buildError = null;
		try {
			for await (const progress of streamDeploymentProgress(scenario)) {
				if (destroyed || wizard.deployStatus !== 'deploying') return;
				steps = progress.steps;
				deployLogs = progress.logs;
				if (progress.errorMessage) buildError = progress.errorMessage;
			}

			if (destroyed || wizard.deployStatus !== 'deploying') return;

			if (scenario === 'failed') {
				await new Promise((resolve) => setTimeout(resolve, 1200));
				if (destroyed || wizard.deployStatus !== 'deploying') return;
			}

			wizard.completeDeploy(scenario !== 'failed');
		} catch (error) {
			console.error('Error during deployment:', error);
			if (!destroyed && wizard.deployStatus === 'deploying') {
				wizard.completeDeploy(false);
			}
		}
	}

	function handleRetryDeploy() {
		steps = [];
		deployLogs = [];
		buildError = null;
		wizard.startDeploy();
	}

	$effect(() => {
		if (wizard.deployStatus === 'deploying') {
			runDeployment('failed');
		}
	});

	$effect(() => {
		return () => {
			destroyed = true;
			clearTimeout(timeoutId);
		};
	});

	const emptyStateConfig = $derived.by<EmptyStateConfig>(() => {
		switch (wizard.deployStatus) {
			case 'success':
				return {
					icon: Check,
					tones: 'neutral',
					title: 'Proyekmu sudah live',
					description: `${wizard.selectedRepository?.name ?? 'Repository'} berhasil dibuat dan bias diakses public sekarang`
				};

			case 'failed':
				return {
					icon: X,
					tones: 'failed',
					title: 'Deployment gagal',
					description: 'Terjadi kesalahan saat mendeploy proyekmu ke Sakala.'
				};

			default:
				return {
					icon: RefreshCw,
					tones: 'neutral',
					title: `Mendeploy ${wizard.selectedRepository?.name ?? 'repository'}...`,
					description: 'Proses deployment sedang berjalan, harap tunggu sebentar.'
				};
		}
	});
</script>

<EmptyState
	icon={emptyStateConfig?.icon}
	tone={emptyStateConfig?.tones}
	class="bg-transparent border-none shadow-none"
	title={emptyStateConfig?.title}
	description={emptyStateConfig?.description}
/>

{#if wizard.deployStatus === 'deploying' || wizard.deployStatus === 'cancelling'}
	<div class="flex flex-col rounded-lg p-4">
		<DeploymentTimeline {steps} />
	</div>

	<DeploymentLogConsole lines={deployLogs} />
{:else if wizard.deployStatus === 'success'}
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
		<Button variant="outline" disabled class="mt-4 w-full justify-center gap-2 border-black py-3">
			Lihat Detail Proyek
		</Button>
		<Button
			externalHref={url}
			variant="primary"
			class="mt-4 w-full justify-center gap-2 border-2 py-3 border-none text-white cursor-pointer"
		>
			Buka situs
			<ArrowRight class="w-5 h-5" />
		</Button>
	</div>
{:else if wizard.deployStatus === 'failed'}
	<div class="flex flex-col rounded-lg p-4">
		<Card class="bg-error/10 border border-error rounded-lg">
			<p class="font-montserrat-semibold text-error">BUILD ERROR</p>
			<p class="font-jetbrains-mono-regular text-error">
				{buildError ?? 'Terjadi kesalahan saat membangun proyek.'}
			</p>
		</Card>
	</div>
	<div class="flex gap-2 w-full">
		<Button variant="outline" disabled class="mt-4 w-full justify-center gap-2 border-black py-3">
			Lihat log lengkap
		</Button>
		<Button
			variant="primary"
			onclick={handleRetryDeploy}
			class="mt-4 w-full justify-center gap-2 border-2 py-3 border-none text-white cursor-pointer"
		>
			<RotateCcw class="w-5 h-5" />
			Coba lagi
		</Button>
	</div>
{:else if wizard.deployStatus === 'cancelled'}
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

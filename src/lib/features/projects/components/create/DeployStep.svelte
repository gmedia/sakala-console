<script lang="ts">
	import { RefreshCw, Check, X } from '@lucide/svelte';
	import EmptyState from '$lib/components/feedback/EmptyState.svelte';
	import type { Repository } from '../../type';
	import DeploymentTimeline from '$lib/features/deployments/components/DeploymentTimeline.svelte';
	import DeploymentLogConsole from '$lib/features/deployments/components/DeploymentLogConsole.svelte';
	import type { DeploymentStep } from '../../type';

	type Props = {
		repository: Repository | null;
	};

	type EmptyStateConfig = {
		icon: typeof RefreshCw | typeof Check | typeof X;
		tones: 'neutral' | 'failed' | 'warning' | 'muted';
		title: string;
		description: string;
	};

	let { repository = $bindable() }: Props = $props();

	const repositoryName = $derived(repository?.full_name.split('/')[1] ?? 'repository');

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
					title: 'Deployment berhasil',
					description: 'Proyekmu berhasil dideploy ke Sakala.'
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
					title: `Mendeploy ${repositoryName ?? 'repository'}...`,
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

{#if overallStatus === 'running'}
	<div class="flex flex-col rounded-lg p-4">
		<DeploymentTimeline {steps} />
	</div>

	<DeploymentLogConsole lines={deployLogs} />
{/if}

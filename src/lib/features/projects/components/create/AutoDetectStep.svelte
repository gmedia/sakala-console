<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import { resolve } from '$app/paths';
	import { LinkIcon, LightningIcon, CheckIcon } from 'phosphor-svelte';
	import { cn } from '$lib/utils/cn';
	import { CircleNotchIcon, XIcon, ArrowCounterClockwiseIcon } from 'phosphor-svelte';
	import { getCreateProjectContext } from '$lib/features/projects/create/createProjectContext';

	type Props = {
		onNext: () => void;
		onRetryScan?: () => void;
	};

	let { onNext, onRetryScan }: Props = $props();

	const wizard = getCreateProjectContext();
</script>

{#snippet skeletonRow(label: string)}
	<div class="h-4 max-w-max flex items-center gap-2 p-2">
		<CircleNotchIcon class="animate-spin text-primary w-5 h-5" />
		<p class="text-sm text-muted-foreground">{label}</p>
	</div>
{/snippet}

{#snippet notFoundRow(label: string)}
	<div class="h-4 max-w-max flex items-center gap-2 p-2">
		<XIcon class="text-error w-5 h-5" />
		<p class="text-sm text-error">
			{label}
		</p>
	</div>
{/snippet}

<div class="flex flex-col">
	<p class="font-montserrat-semibold text-xl">Sakala membaca proyekmu</p>
	<p>
		Konfigurasi terdeteksi otomatis dari <span class="font-jetbrains-mono-regular"
			>{wizard.selectedRepository?.full_name}</span
		>
	</p>
</div>

<Card class="rounded-xl border flex flex-col gap-4 p-4 mt-4">
	<div class="flex justify-between items-center w-full py-3 border-b border-muted/20">
		<p>Repository</p>
		{#if wizard.scanning}
			{@render skeletonRow('Mendeteksi konfigurasi...')}
		{:else if wizard.selectedRepository}
			<p class="font-jetbrains-mono-semibold">{wizard.selectedRepository?.full_name}</p>
		{:else}
			{@render notFoundRow('Tidak terdeteksi')}
		{/if}
	</div>
	<div class="flex justify-between items-center w-full py-3 border-b border-muted/20">
		<p>Branch</p>
		{#if wizard.scanning}
			{@render skeletonRow('Mendeteksi konfigurasi...')}
		{:else if wizard.selectedBranch}
			<p class="font-jetbrains-mono-semibold">{wizard.selectedBranch}</p>
		{:else}
			{@render notFoundRow('Tidak terdeteksi')}
		{/if}
	</div>
	<div class="flex justify-between items-center w-full py-3 border-b border-muted/20">
		<p>Builder</p>
		{#if wizard.scanning}
			{@render skeletonRow('Mendeteksi konfigurasi...')}
		{:else if wizard.builderDetected}
			<p class="font-montserrat-semibold flex gap-1">
				<CheckIcon class="text-primary w-6 h-6" /> Dockerfile terdeteksi
			</p>
		{:else}
			{@render notFoundRow('Tidak terdeteksi')}
		{/if}
	</div>
	<div class="flex justify-between items-center w-full py-3">
		<p>Port</p>
		{#if wizard.scanning}
			{@render skeletonRow('Mendeteksi konfigurasi...')}
		{:else if wizard.selectedPort}
			<p class="font-jetbrains-mono-semibold">{wizard.selectedPort}</p>
		{:else}
			{@render notFoundRow('Tidak terdeteksi')}
		{/if}
	</div>
</Card>

<div class="flex text-primary items-center bg-primary/8 p-4 rounded-lg gap-2 my-4">
	{#if wizard.scanning}
		{@render skeletonRow('Mempersiapkan preview URL...')}
	{:else}
		<LinkIcon class="h-6 w-6" />
		<p class="font-jetbrains-mono-regular">{wizard.projectName}.run.sakala.dev</p>
	{/if}
</div>

{#if wizard.scanFailed}
	<Button
		variant="primary"
		class="mt-4 w-full justify-center gap-2 border-black py-3"
		onclick={onRetryScan}
	>
		<ArrowCounterClockwiseIcon class="h-5 w-5" />
		Scan Ulang
	</Button>
{:else}
	<Button
		variant="primary"
		class="mt-4 w-full justify-center gap-2 border-2 py-3"
		disabled={wizard.scanning || !wizard.builderDetected}
		onclick={onNext}
	>
		<LightningIcon class="h-5 w-5" />
		Deploy sekarang
	</Button>
{/if}
<Button
	href={resolve('/projects')}
	variant="outline"
	class={cn(
		'mt-4 w-full justify-center gap-2 border-2 py-3 border-none text-primary cursor-pointer'
	)}
	disabled={wizard.scanning}
	onclick={onNext}
>
	Lewati
</Button>

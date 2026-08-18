<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import { resolve } from '$app/paths';
	import { LinkIcon, LightningIcon, CheckIcon } from 'phosphor-svelte';
	import { cn } from '$lib/utils/cn';
	import type { Repository } from '../../type';
	import { CircleNotchIcon, XIcon, ArrowCounterClockwiseIcon } from 'phosphor-svelte';

	type Props = {
		repository: Repository | null;
		branch: string;
		port: string;
		projectName: string;
		scanning: boolean;
		builderDetected: boolean | null;
		scanFailed?: boolean;
		onNext: () => void;
		onRetryScan?: () => void;
	};

	let {
		repository,
		branch,
		port,
		projectName,
		scanning,
		builderDetected,
		scanFailed = false,
		onNext,
		onRetryScan
	}: Props = $props();
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
			>{repository?.full_name}</span
		>
	</p>
</div>

<Card class="rounded-xl border flex flex-col gap-4 p-4 mt-4">
	<div class="flex justify-between items-center w-full py-3 border-b border-muted/20">
		<p>Repository</p>
		{#if scanning}
			{@render skeletonRow('Mendeteksi konfigurasi...')}
		{:else if repository}
			<p class="font-jetbrains-mono-semibold">{repository?.full_name}</p>
		{:else}
			{@render notFoundRow('Tidak terdeteksi')}
		{/if}
	</div>
	<div class="flex justify-between items-center w-full py-3 border-b border-muted/20">
		<p>Branch</p>
		{#if scanning}
			{@render skeletonRow('Mendeteksi konfigurasi...')}
		{:else if branch}
			<p class="font-jetbrains-mono-semibold">{branch}</p>
		{:else}
			{@render notFoundRow('Tidak terdeteksi')}
		{/if}
	</div>
	<div class="flex justify-between items-center w-full py-3 border-b border-muted/20">
		<p>Builder</p>
		{#if scanning}
			{@render skeletonRow('Mendeteksi konfigurasi...')}
		{:else if builderDetected}
			<p class="font-montserrat-semibold flex gap-1">
				<CheckIcon class="text-primary" /> Dockerfile terdeteksi
			</p>
		{:else}
			{@render notFoundRow('Tidak terdeteksi')}
		{/if}
	</div>
	<div class="flex justify-between items-center w-full py-3">
		<p>Port</p>
		{#if scanning}
			{@render skeletonRow('Mendeteksi konfigurasi...')}
		{:else if port}
			<p class="font-jetbrains-mono-semibold">{port}</p>
		{:else}
			{@render notFoundRow('Tidak terdeteksi')}
		{/if}
	</div>
</Card>

<div class="flex text-primary items-center bg-primary/8 p-4 rounded-lg gap-2 my-4">
	{#if scanning}
		{@render skeletonRow('Mempersiapkan preview URL...')}
	{:else}
		<LinkIcon class="h-6 w-6" />
		<p class="font-jetbrains-mono-regular">{projectName}.run.sakala.dev</p>
	{/if}
</div>

{#if scanFailed}
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
		disabled={scanning || !builderDetected}
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
	disabled={scanning}
	onclick={onNext}
>
	Lewati
</Button>

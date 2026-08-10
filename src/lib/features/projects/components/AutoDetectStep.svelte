<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import { Link, Zap, Check, ChevronDown } from '@lucide/svelte';
	import { cn } from '$lib/utils/cn';
	import type { Repository } from '../type';

	type Props = {
		repository: Repository | null;
		branch: string;
		port: string;
		projectName: string;
		onNext: () => void;
	};

	let { repository, branch, port, projectName, onNext }: Props = $props();
	let isOpen = $state(false);
</script>

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
		<p class="font-jetbrains-mono-semibold">{repository?.full_name}</p>
	</div>
	<div class="flex justify-between items-center w-full py-3 border-b border-muted/20">
		<p>Branch</p>
		<p class="font-jetbrains-mono-semibold">{branch}</p>
	</div>
	<div class="flex justify-between items-center w-full py-3 border-b border-muted/20">
		<p>Builder</p>
		<p class="font-montserrat-semibold flex gap-1">
			<Check class="text-primary" /> Dockerfile terdeteksi
		</p>
	</div>
	<div class="flex justify-between items-center w-full py-3">
		<p>Port</p>
		<p class="font-jetbrains-mono-semibold">{port}</p>
	</div>
</Card>

<div class="flex text-primary bg-primary/8 p-4 rounded-lg gap-2 my-4">
	<Link />
	<p class="font-jetbrains-mono-regular">{projectName}.run.sakala.dev</p>
</div>

<div class="flex flex-col gap-2 mt-4">
	<button
		type="button"
		class="flex items-center gap-1 cursor-pointer"
		onclick={() => (isOpen = !isOpen)}
	>
		<ChevronDown
			class="text-muted transition-transform duration-200 {isOpen ? 'rotate-180' : ''}"
		/>
		<p class="font-montserrat-semibold">Advance settings</p>
	</button>

	{#if isOpen}
		<Card class="rounded-lg">
			<p class="font-medium">Nama Proyek (Opsional)</p>
			<div class="relative py-2">
				<input
					type="text"
					placeholder="my-project"
					value={repository?.full_name.split('/')[1]}
					class="w-full rounded-lg border border-muted/20 bg-primary/5 p-2 pr-32 focus:border-transparent focus:ring-muted/10"
				/>

				<span
					class="font-jetbrains-mono-regular pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
				>
					.run.sakala.dev
				</span>
			</div>
			<p class="font-xs font-montserrat-light">
				Default diambil dari nama repository. Bisa diganti kapan saja lewat Settings setelah proyek
				dibuat.
			</p>
		</Card>
	{/if}
</div>

<Button
	variant="primary"
	class={cn('mt-4 w-full justify-center gap-2 border-2 py-3')}
	onclick={onNext}
>
	<Zap />
	Deploy sekarang
</Button>

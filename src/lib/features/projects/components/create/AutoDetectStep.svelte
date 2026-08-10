<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import { resolve } from '$app/paths';
	import { Link, Zap, Check } from '@lucide/svelte';
	import { cn } from '$lib/utils/cn';
	import type { Repository } from '../../type';

	type Props = {
		repository: Repository | null;
		branch: string;
		port: string;
		projectName: string;
		onNext: () => void;
	};

	let { repository, branch, port, projectName, onNext }: Props = $props();
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

<Button
	variant="primary"
	class={cn('mt-4 w-full justify-center gap-2 border-2 py-3')}
	onclick={onNext}
>
	<Zap />
	Deploy sekarang
</Button>
<Button
	href={resolve('/projects')}
	variant="outline"
	class={cn(
		'mt-4 w-full justify-center gap-2 border-2 py-3 border-none text-primary cursor-pointer'
	)}
	onclick={onNext}
>
	Lewati
</Button>

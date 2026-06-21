<script lang="ts">
	import { Boxes, Plus } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/ui/Button.svelte';
	import EmptyState from '$lib/components/feedback/EmptyState.svelte';
</script>

<svelte:head><title>Projects | Sakala Console</title></svelte:head>

<header class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
	<div>
		<p class="text-sm font-semibold text-primary">Projects</p>
		<h1 class="mt-2 text-3xl font-semibold tracking-[-0.035em]">Project yang kamu bawa online.</h1>
		<p class="mt-2 max-w-2xl leading-7 text-muted">
			Status repository, deployment terakhir, dan URL publik akan dirangkum di sini.
		</p>
	</div>
	<Button href={resolve('/projects/new')}><Plus size={18} aria-hidden="true" /> Project baru</Button
	>
</header>

<div class="mt-8">
	<EmptyState
		icon={Boxes}
		title="Belum ada project"
		description="Hubungkan repository pertama setelah API project dan GitHub login tersedia."
	/>
</div>

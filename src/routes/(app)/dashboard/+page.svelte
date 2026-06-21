<script lang="ts">
	import { ArrowRight, Boxes, CircleDot, GitBranch, Plus } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import EmptyState from '$lib/components/feedback/EmptyState.svelte';
</script>

<svelte:head><title>Overview | Sakala Console</title></svelte:head>

<div class="flex flex-col gap-8">
	<header class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
		<div>
			<Badge tone="info">Foundation preview</Badge>
			<h1 class="mt-3 text-3xl font-semibold tracking-[-0.035em]">Selamat datang di Sakala.</h1>
			<p class="mt-2 max-w-2xl leading-7 text-muted">
				Pantau project, deployment, dan URL publik tanpa kehilangan konteks prosesnya.
			</p>
		</div>
		<Button href={resolve('/projects/new')}
			><Plus size={18} aria-hidden="true" /> Project baru</Button
		>
	</header>

	<section class="grid gap-4 sm:grid-cols-3" aria-label="Ringkasan Sakala">
		<Card>
			<div class="flex items-center justify-between">
				<p class="text-sm font-medium text-muted">Projects</p>
				<Boxes size={18} class="text-primary" aria-hidden="true" />
			</div>
			<p class="mt-5 text-3xl font-semibold">0</p>
			<p class="mt-1 text-sm text-muted">Belum ada project terhubung.</p>
		</Card>
		<Card>
			<div class="flex items-center justify-between">
				<p class="text-sm font-medium text-muted">Deployment aktif</p>
				<CircleDot size={18} class="text-success" aria-hidden="true" />
			</div>
			<p class="mt-5 text-3xl font-semibold">0</p>
			<p class="mt-1 text-sm text-muted">Runtime akan tampil di sini.</p>
		</Card>
		<Card>
			<div class="flex items-center justify-between">
				<p class="text-sm font-medium text-muted">Repository</p>
				<GitBranch size={18} class="text-accent" aria-hidden="true" />
			</div>
			<p class="mt-5 text-3xl font-semibold">0</p>
			<p class="mt-1 text-sm text-muted">GitHub login belum dihubungkan.</p>
		</Card>
	</section>

	<EmptyState
		icon={Boxes}
		title="Mulai dari satu repository"
		description="Saat alur project tersedia, Sakala akan membantu membaca repository dan menunjukkan setiap tahap sebelum URL publik siap dibagikan."
	>
		{#snippet action()}
			<Button href={resolve('/projects/new')} variant="secondary">
				Lihat alur project <ArrowRight size={18} aria-hidden="true" />
			</Button>
		{/snippet}
	</EmptyState>
</div>

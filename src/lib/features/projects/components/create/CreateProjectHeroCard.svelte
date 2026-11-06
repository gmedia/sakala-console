<script lang="ts">
	import Plus from 'phosphor-svelte/lib/Plus';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/ui/Button.svelte';

	const steps = [
		'Pilih repository dari GitHub',
		'Atur branch dan environment variable',
		'Deploy, lalu baca log-nya'
	];
</script>

<section class="surface-card p-6" aria-labelledby="first-project-title">
	<h2 id="first-project-title" class="text-xl">Buat proyek pertamamu</h2>
	<p class="mt-1 text-sm text-muted">
		Proyek menyimpan deployment, alamat publik, dan pengaturan aplikasimu di satu tempat.
	</p>
	<ol class="mt-5 space-y-3">
		{#each steps as step, index (step)}
			<li class="flex items-center gap-3 text-sm text-foreground">
				<span
					class="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-50 font-semibold text-primary-dark"
				>
					{index + 1}
				</span>
				{step}
			</li>
		{/each}
	</ol>
	<Button href={resolve('/projects/new')} class="mt-6">
		<Plus size={16} weight="bold" aria-hidden="true" />
		Buat proyek
	</Button>
</section>

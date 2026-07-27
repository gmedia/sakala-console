<script lang="ts">
	import { Plus, Rocket } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/ui/Button.svelte';
	import EmptyState from '$lib/components/feedback/EmptyState.svelte';

	type Props = {
		isEmpty?: boolean;
	};

	let { isEmpty = false }: Props = $props();
</script>

{#if isEmpty}
	<EmptyState
		icon={Plus}
		title="Buat Proyek Baru"
		description="Proyek menyimpan deployment, domain, dan pengaturan timmu dalam satu tempat. Buat satu untuk mulai deploy."
	>
		{#snippet action()}
			<Button href={resolve('/projects/new')} variant="primary">
				<Rocket size={18} />
				Mulai Sekarang
			</Button>
		{/snippet}
	</EmptyState>
{:else}
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div class="space-y-1">
			<h1 class="text-[22px] font-semibold text-foreground">Projects</h1>
			<p class="text-[18px] font-normal text-muted">
				Terus lanjutkan progresmu, deploy proyek berikutnya.
			</p>
		</div>
		<div>
			<Button
				href={resolve('/projects/new')}
				variant="primary"
				class="h-12 w-42.5 rounded-lg px-0 py-0 text-[16px] font-semibold text-white"
			>
				<Plus size={18} />
				Buat Proyek
			</Button>
		</div>
	</div>
{/if}

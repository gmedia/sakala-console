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

<EmptyState
	icon={Plus}
	title="Buat Proyek Baru"
	description="Proyek menyimpan deployment, domain, dan pengaturan timmu dalam satu tempat. Buat satu untuk mulai deploy."
>
	{#snippet action()}
		{#if isEmpty}
			<Button href={resolve('/projects/new')} variant="primary">
				<Rocket size={18} />
				Mulai Sekarang
			</Button>
		{:else}
			<Button href={resolve('/projects/new')} variant="primary">
				<Plus size={18} />
				Buat Proyek
			</Button>
		{/if}
	{/snippet}
</EmptyState>

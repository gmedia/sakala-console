<script lang="ts">
	import CaretLeft from 'phosphor-svelte/lib/CaretLeft';
	import CaretRight from 'phosphor-svelte/lib/CaretRight';
	import Button from './Button.svelte';

	type Props = {
		currentPage: number;
		totalPages: number;
		onPageChange: (page: number) => void;
		disabled?: boolean;
	};
	let { currentPage, totalPages, onPageChange, disabled = false }: Props = $props();

	const DOTS = 'dots' as const;

	const pages = $derived.by(() => {
		if (totalPages <= 5) {
			return Array.from({ length: totalPages }, (_, i) => i + 1);
		}

		if (currentPage <= 3) {
			return [1, 2, 3, DOTS, totalPages];
		}

		if (currentPage >= totalPages - 2) {
			return [1, DOTS, totalPages - 2, totalPages - 1, totalPages];
		}
		return [1, DOTS, currentPage, DOTS, totalPages];
	});
</script>

{#if totalPages > 1}
	<nav
		class="mt-3 flex flex-wrap items-center justify-center gap-2"
		aria-label="Navigasi halaman"
		aria-busy={disabled}
	>
		<Button
			variant="secondary"
			size="icon"
			aria-label="Halaman sebelumnya"
			disabled={disabled || currentPage === 1}
			onclick={() => onPageChange(currentPage - 1)}
		>
			<CaretLeft size={16} weight="bold" aria-hidden="true" />
		</Button>
		{#each pages as page, i (page === DOTS ? `dots-${i}` : page)}
			{#if page === DOTS}
				<span
					class="flex size-control-md items-center justify-center text-sm text-muted select-none"
				>
					...
				</span>
			{:else}
				<Button
					variant={page === currentPage ? 'primary' : 'secondary'}
					size="icon"
					aria-label={`Halaman ${page}`}
					aria-current={page === currentPage ? 'page' : undefined}
					disabled={disabled || page === currentPage}
					class={page === currentPage
						? 'disabled:border-primary disabled:bg-primary disabled:text-white'
						: undefined}
					onclick={() => onPageChange(page)}
				>
					{page}
				</Button>
			{/if}
		{/each}
		<Button
			variant="secondary"
			size="icon"
			aria-label="Halaman berikutnya"
			disabled={disabled || currentPage === totalPages}
			onclick={() => onPageChange(currentPage + 1)}
		>
			<CaretRight size={16} weight="bold" aria-hidden="true" />
		</Button>
	</nav>
{/if}

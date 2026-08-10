<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import { ChevronLeft, ChevronRight } from '@lucide/svelte';
	type Props = {
		currentPage: number;
		totalPages: number;
		onPageChange: (page: number) => void;
		class?: string;
	};
	let { currentPage, totalPages, onPageChange, class: buttonClass }: Props = $props();
	const baseButton = $derived(
		cn(
			buttonClass,
			'flex items-center justify-center text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
			'cursor-pointer font-montserrat-semibold rounded-lg w-10 h-8 border'
		)
	);

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
	<nav class="flex items-center justify-center gap-2 mt-3" aria-label="Pagination">
		<button
			aria-label="Previous Page"
			disabled={currentPage === 1}
			onclick={() => onPageChange(currentPage - 1)}
			class="{baseButton} flex items-center justify-center bg-white text-muted border-muted/30 disabled:opacity-50 disabled:cursor-not-allowed"
		>
			<ChevronLeft class="w-6 h-6" />
		</button>
		{#each pages as page, i (page === DOTS ? `dots-${i}` : page)}
			{#if page === DOTS}
				<span class="flex items-center justify-center w-10 h-8 text-sm text-muted select-none">
					...
				</span>
			{:else}
				<button
					aria-label={`Page ${page}`}
					aria-current={page === currentPage ? 'page' : undefined}
					onclick={() => onPageChange(page)}
					class="{baseButton} {page === currentPage
						? 'bg-primary text-white border-primary'
						: 'bg-surface-elevated text-muted border-muted/30'}"
				>
					{page}
				</button>
			{/if}
		{/each}
		<button
			disabled={currentPage === totalPages}
			onclick={() => onPageChange(currentPage + 1)}
			class="{baseButton} flex items-center justify-center bg-white text-muted border-muted/30 disabled:opacity-50 disabled:cursor-not-allowed"
		>
			<ChevronRight class="w-6 h-6" />
		</button>
	</nav>
{/if}
